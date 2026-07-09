import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AccessTokenPayload,
  AccessTokenResponse,
  AuthTokens,
  RegisteredUser,
} from '@hep/shared-types';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { AccessTokenService } from './access-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { UserRole } from './user-role.enum';
import { User } from './user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { hashPassword, verifyPassword } from './password-hasher.util';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';
import { getAuthConfig } from '../config/auth.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

/** Uniform message for every credential-related failure (AC3). */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
/** Uniform message for every refresh-token failure (AC4). */
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid or expired refresh token.';

/**
 * Lazily computed and cached: an Argon2 hash of a fixed placeholder,
 * verified against instead of short-circuiting when `login()` is called for
 * an email that has no matching user. This means `argon2.verify` always
 * does real hashing work on the login path, closing the most obvious
 * timing oracle (a nonexistent-user login returning near-instantly vs. a
 * real one taking however long Argon2 takes) without attempting full
 * constant-time guarantees beyond what Argon2's own verify already gives
 * (AC3: "a reasonable mitigation is enough").
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('auth-service-timing-mitigation-dummy');
  }
  return dummyHashPromise;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly accessTokenService: AccessTokenService,
    private readonly authSchemaProvisioner: AuthSchemaProvisioner,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** AC1: creates a user scoped to the resolved tenant. */
  async register(dto: RegisterDto): Promise<RegisteredUser> {
    await this.ensureSchema();
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.usersRepository.create({
        id: randomUUID(),
        email,
        passwordHash,
        role: UserRole.MEMBER,
      });
      return this.toRegisteredUser(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  /** AC2/AC3: issues access + refresh tokens for valid credentials. */
  async login(dto: LoginDto): Promise<AuthTokens> {
    await this.ensureSchema();
    const email = normalizeEmail(dto.email);
    const user = await this.usersRepository.findByEmail(email);

    // Always run a real Argon2 verify, even for a nonexistent user (see
    // `getDummyHash` doc comment) -- never short-circuit before hashing.
    const hashToVerify = user ? user.passwordHash : await getDummyHash();
    const passwordValid = await verifyPassword(hashToVerify, dto.password);

    if (!user || !passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueTokens(user);
  }

  /** AC4: exchanges a valid, unrevoked, unexpired refresh token for a new access token. */
  async refresh(dto: RefreshDto): Promise<AccessTokenResponse> {
    await this.ensureSchema();
    const tokenHash = hashRefreshToken(dto.refreshToken);
    const stored =
      await this.refreshTokensRepository.findByTokenHash(tokenHash);

    if (!stored || stored.revoked || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const user = await this.usersRepository.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const { token, expiresIn } = this.accessTokenService.sign(
      this.buildPayload(user),
    );
    return { accessToken: token, expiresIn };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const { token: accessToken, expiresIn } = this.accessTokenService.sign(
      this.buildPayload(user),
    );

    const refreshToken = generateRefreshToken();
    const config = getAuthConfig();
    await this.refreshTokensRepository.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
    });

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Ensures this tenant's `users`/`refresh_tokens` tables exist before any
   * repository query runs. Idempotent and cheap after the first call per
   * schema (see `AuthSchemaProvisioner`'s in-process cache) -- kept in the
   * service layer (not the shared `TenantGuard`) because provisioning
   * auth's own domain tables is an auth-domain concern, not a generic
   * tenant-resolution one.
   */
  private ensureSchema(): Promise<void> {
    return this.authSchemaProvisioner.ensureProvisioned(
      this.tenantContext.getTenant().schemaName,
    );
  }

  private buildPayload(user: User): AccessTokenPayload {
    return {
      userId: user.id,
      tenantId: this.tenantContext.getTenant().id,
      role: user.role,
    };
  }

  private toRegisteredUser(user: User): RegisteredUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
