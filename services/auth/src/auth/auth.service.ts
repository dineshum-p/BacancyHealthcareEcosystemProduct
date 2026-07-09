import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AccessTokenPayload,
  AccessTokenResponse,
  AuthTokens,
  LoginResult,
  MfaActivation,
  MfaEnrollment,
  RegisteredUser,
  RoleDefinition,
} from '@hep/shared-types';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { MfaRecoveryCodesRepository } from './mfa-recovery-codes.repository';
import { AccessTokenService } from './access-token.service';
import {
  MfaChallengePayload,
  MfaChallengeTokenService,
} from './mfa-challenge-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { DEFAULT_REGISTRATION_ROLE, UserRole } from './user-role.enum';
import { ALL_ROLES, getPermissionsForRole } from './role-permissions.map';
import { MfaStatus } from './mfa-status.enum';
import { User } from './user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { hashPassword, verifyPassword } from './password-hasher.util';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';
import {
  decryptTotpSecret,
  encryptTotpSecret,
} from './totp-secret-cipher.util';
import {
  buildOtpauthUri,
  generateTotpSecret,
  verifyTotpCode,
} from './totp.util';
import { generateRecoveryCodes, hashRecoveryCode } from './recovery-code.util';
import { getAuthConfig } from '../config/auth.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';

/** Uniform message for every credential-related failure (AC3). */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
/** Uniform message for every refresh-token failure (AC4). */
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid or expired refresh token.';
/**
 * Uniform message for every MFA-code-related failure across both
 * enrollment completion and login completion (AC4): an invalid code, a
 * reused code, and an invalid/expired challenge token are all
 * indistinguishable to the caller, mirroring AC3's uniform-401 precedent so
 * nothing about *why* a code was rejected leaks.
 */
const INVALID_MFA_CODE_MESSAGE = 'Invalid or expired authentication code.';
/** Uniform message when the authenticated caller's own account vanished mid-request. */
const ACCOUNT_NOT_FOUND_MESSAGE = 'Invalid or expired access token.';
/** Distinct from AC4's message: this is a state-conflict, not a bad code. */
const NO_PENDING_ENROLLMENT_MESSAGE =
  'No pending MFA enrollment for this user.';
/**
 * BAC-7: returned both when the target user genuinely does not exist AND
 * when it exists but in a different tenant's schema (`UsersRepository`'s
 * queries -- including the lookup inside `updateUserRole` -- are always
 * scoped to the CALLER's resolved tenant, so a cross-tenant id simply never
 * resolves). This is a deliberate byproduct of tenant isolation, not a
 * distinct code path: a 404 here never confirms or denies that a user id
 * exists in SOME other tenant.
 */
const USER_NOT_FOUND_MESSAGE = 'User not found.';

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
    private readonly mfaRecoveryCodesRepository: MfaRecoveryCodesRepository,
    private readonly accessTokenService: AccessTokenService,
    private readonly mfaChallengeTokenService: MfaChallengeTokenService,
    private readonly authSchemaProvisioner: AuthSchemaProvisioner,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * AC1: creates a user scoped to the resolved tenant.
   *
   * BAC-7 bootstrap-admin resolution: role-assignment (`updateUserRole`)
   * requires an EXISTING role-manager (`MANAGE_USER_ROLES`) to grant a role,
   * which creates a bootstrap problem -- there would be no way to ever get a
   * `super_admin` for a brand-new tenant via the API alone. This is resolved
   * minimally, without a separate seeding/admin-invite feature: the FIRST
   * user ever registered for a given tenant (`usersRepository.count() ===
   * 0`, checked against THIS tenant's schema only) is automatically assigned
   * `SUPER_ADMIN` instead of the default `STAFF`; every subsequent
   * registration in that tenant gets `DEFAULT_REGISTRATION_ROLE` (`STAFF`,
   * the least-privileged role -- a safe, unprivileged default for anyone who
   * self-registers rather than being invited/promoted by an admin).
   *
   * Not race-proof: two concurrent first-ever registrations for the same
   * brand-new tenant could both observe `count() === 0` and both become
   * `super_admin`. Accepted as a minimal, self-contained fix per this
   * ticket's scope -- a real invite/seeding flow (out of scope here) would
   * close this gap properly.
   */
  async register(dto: RegisterDto): Promise<RegisteredUser> {
    await this.ensureSchema();
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    const existingUserCount = await this.usersRepository.count();
    const role =
      existingUserCount === 0
        ? UserRole.SUPER_ADMIN
        : DEFAULT_REGISTRATION_ROLE;

    try {
      const user = await this.usersRepository.create({
        id: randomUUID(),
        email,
        passwordHash,
        role,
      });
      return this.toRegisteredUser(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  /**
   * BAC-7, AC1: the seeded role -> permission-set catalog, queryable over
   * HTTP via `GET /auth/roles`. Guarded by `AccessTokenGuard` only (no
   * specific permission) -- it is read-only metadata about the RBAC model
   * itself, not a specific user's or tenant's data, so any authenticated
   * caller may read it.
   */
  listRoles(): RoleDefinition[] {
    return ALL_ROLES.map((role) => ({
      role,
      permissions: [...getPermissionsForRole(role)],
    }));
  }

  /**
   * BAC-7, AC4: updates a user's role. The next access/refresh token issued
   * for that user (their next login, or their next `/auth/refresh`) will
   * carry the new role -- this does NOT retroactively invalidate any
   * already-issued access token, since no revocation infrastructure exists
   * for access tokens (only for refresh tokens, per BAC-5/6); building that
   * is out of scope for this ticket.
   *
   * Tenant isolation: `usersRepository.updateRole` only ever touches the
   * CALLER's resolved tenant's schema (see `TenantContextService`), so a
   * `userId` belonging to a different tenant simply does not exist in that
   * schema and this throws `NotFoundException` (404) -- the same outcome as
   * a genuinely unknown id, by design (see `USER_NOT_FOUND_MESSAGE`'s doc
   * comment): cross-tenant role assignment is structurally impossible, not
   * merely rejected after the fact.
   *
   * Self-role-change and de-escalating a tenant's last `super_admin` are
   * both deliberately NOT prevented -- an accepted, documented scope call
   * for this ticket rather than over-building a more elaborate policy.
   */
  async updateUserRole(
    userId: string,
    role: UserRole,
  ): Promise<RegisteredUser> {
    await this.ensureSchema();
    const updated = await this.usersRepository.updateRole(userId, role);
    if (!updated) {
      throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    }
    return this.toRegisteredUser(updated);
  }

  /**
   * AC2/AC3: issues access + refresh tokens for valid credentials -- UNLESS
   * the account's MFA is `active` (BAC-6, AC3), in which case this returns
   * an `mfa_required` challenge instead and issues no tokens at all.
   * `POST /auth/mfa/login-verify` (`completeMfaLogin`) exchanges that
   * challenge, plus a valid TOTP code, for real tokens.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
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

    if (user.mfaStatus === MfaStatus.ACTIVE) {
      const mfaChallengeToken = this.mfaChallengeTokenService.sign(
        user.id,
        this.tenantContext.getTenant().id,
      );
      return { mfaRequired: true, mfaChallengeToken };
    }

    return this.issueTokens(user);
  }

  /**
   * AC1: begins MFA enrollment for the authenticated caller (identified by
   * `AccessTokenGuard`, not by anything in the request body) -- generates a
   * fresh TOTP secret, persists it encrypted (never in plaintext, never
   * logged), and marks the user `pending`. MFA is NOT enforced at login
   * until `verifyMfaEnrollment` confirms a code against this secret.
   *
   * Returns the raw secret + `otpauth://` URI so the caller can display a
   * QR code / manual-entry key; calling this again before verifying simply
   * restarts enrollment with a new secret (see `UsersRepository.
   * startMfaEnrollment`'s doc comment).
   */
  async enrollMfa(userId: string): Promise<MfaEnrollment> {
    await this.ensureSchema();
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    const secret = generateTotpSecret();
    const tenant = this.tenantContext.getTenant();
    const otpauthUrl = buildOtpauthUri(user.email, tenant.name, secret);

    await this.usersRepository.startMfaEnrollment(
      user.id,
      encryptTotpSecret(secret),
    );

    return { secret, otpauthUrl };
  }

  /**
   * AC2: completes MFA enrollment for the authenticated caller. Requires
   * `mfaStatus === 'pending'` (a `ConflictException`/409 otherwise -- this
   * is a state conflict, not a bad code, so it gets a different message
   * than AC4's uniform invalid-code 401). On a valid code: activates MFA,
   * records the matched step as the initial replay-prevention floor, and
   * returns freshly generated recovery codes -- the ONLY time their raw
   * values are ever available; only their hashes are persisted.
   */
  async verifyMfaEnrollment(
    userId: string,
    dto: MfaVerifyDto,
  ): Promise<MfaActivation> {
    await this.ensureSchema();
    const user = await this.usersRepository.findById(userId);
    if (
      !user ||
      user.mfaStatus !== MfaStatus.PENDING ||
      !user.mfaSecretEncrypted
    ) {
      throw new ConflictException(NO_PENDING_ENROLLMENT_MESSAGE);
    }

    const secret = decryptTotpSecret(user.mfaSecretEncrypted);
    const matchedStep = verifyTotpCode(secret, dto.totpCode);
    if (matchedStep === null) {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
    }

    const activated = await this.usersRepository.activateMfa(
      user.id,
      matchedStep,
    );
    if (!activated) {
      // Status changed (e.g. a concurrent request already activated it)
      // between the read above and this write -- treat as a state
      // conflict, not a bad code.
      throw new ConflictException(NO_PENDING_ENROLLMENT_MESSAGE);
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map(hashRecoveryCode),
    );
    await this.mfaRecoveryCodesRepository.replaceAll(
      user.id,
      recoveryCodeHashes,
    );

    return { recoveryCodes };
  }

  /**
   * AC3/AC4: exchanges a login-time MFA challenge (from `login()`) plus a
   * valid, unused TOTP code for real `AuthTokens`. Every failure mode --
   * a malformed/expired/wrong-tenant challenge token, a user whose MFA is
   * no longer active, an invalid code, or a replayed code -- collapses to
   * the same uniform 401 (`INVALID_MFA_CODE_MESSAGE`) and issues no tokens,
   * mirroring AC3's login precedent of not leaking *why* a request failed.
   */
  async completeMfaLogin(dto: MfaLoginVerifyDto): Promise<AuthTokens> {
    await this.ensureSchema();

    let payload: MfaChallengePayload;
    try {
      payload = this.mfaChallengeTokenService.verify(dto.mfaChallengeToken);
    } catch {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
    }
    if (payload.tenantId !== this.tenantContext.getTenant().id) {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
    }

    const user = await this.usersRepository.findById(payload.userId);
    if (
      !user ||
      user.mfaStatus !== MfaStatus.ACTIVE ||
      !user.mfaSecretEncrypted
    ) {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
    }

    const secret = decryptTotpSecret(user.mfaSecretEncrypted);
    const matchedStep = verifyTotpCode(secret, dto.totpCode);
    if (matchedStep === null) {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
    }

    // Atomic replay check: only one of two concurrent requests presenting
    // the same code can ever advance `mfa_last_used_step` (see
    // `UsersRepository.recordMfaStepIfNewer`'s doc comment). Must happen
    // BEFORE issuing tokens so a rejected/reused code never gets any.
    const accepted = await this.usersRepository.recordMfaStepIfNewer(
      user.id,
      matchedStep,
    );
    if (!accepted) {
      throw new UnauthorizedException(INVALID_MFA_CODE_MESSAGE);
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
