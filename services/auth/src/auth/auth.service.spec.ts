import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { AccessTokenService } from './access-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { Tenant } from '../tenants/tenant.entity';
import { UserRole } from './user-role.enum';
import { User } from './user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { hashPassword } from './password-hasher.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

describe('AuthService', () => {
  let usersRepository: jest.Mocked<UsersRepository>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let accessTokenService: jest.Mocked<AccessTokenService>;
  let authSchemaProvisioner: jest.Mocked<AuthSchemaProvisioner>;
  let tenantContext: jest.Mocked<TenantContextService>;
  let service: AuthService;

  const tenant: Tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
  };

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    refreshTokensRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;
    accessTokenService = {
      sign: jest
        .fn()
        .mockReturnValue({ token: 'signed.jwt.token', expiresIn: 900 }),
      verify: jest.fn(),
    } as unknown as jest.Mocked<AccessTokenService>;
    authSchemaProvisioner = {
      ensureProvisioned: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthSchemaProvisioner>;
    tenantContext = {
      getTenant: jest.fn().mockReturnValue(tenant),
    } as unknown as jest.Mocked<TenantContextService>;

    service = new AuthService(
      usersRepository,
      refreshTokensRepository,
      accessTokenService,
      authSchemaProvisioner,
      tenantContext,
    );
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'Ada@Example.com',
      password: 'super-secret-1',
    };

    it('provisions the tenant schema before creating the user', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve({ ...user, createdAt: new Date() }),
      );

      await service.register(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });

    it('normalizes the email to lowercase and defaults role to member (AC1)', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve({ ...user, createdAt: new Date() }),
      );

      const result = await service.register(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          role: UserRole.MEMBER,
        }),
      );
      expect(result).toMatchObject({
        email: 'ada@example.com',
        role: UserRole.MEMBER,
      });
      expect(typeof result.id).toBe('string');
      expect(typeof result.createdAt).toBe('string');
    });

    it('never returns the password hash', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve({ ...user, createdAt: new Date() }),
      );

      const result = await service.register(dto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain(dto.password);
    });

    it('stores an argon2 hash, not the plaintext password', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve({ ...user, createdAt: new Date() }),
      );

      await service.register(dto);

      const [createArg] = usersRepository.create.mock.calls[0];
      expect(createArg.passwordHash).not.toBe(dto.password);
      expect(createArg.passwordHash.startsWith('$argon2')).toBe(true);
    });

    it('translates a duplicate email into ConflictException (409)', async () => {
      usersRepository.create.mockRejectedValue(
        new EmailAlreadyExistsError('ada@example.com'),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'Ada@Example.com',
      password: 'correct-password',
    };

    it('issues access + refresh tokens for valid credentials (AC2)', async () => {
      const passwordHash = await hashPassword('correct-password');
      const user: User = {
        id: 'user-1',
        email: 'ada@example.com',
        passwordHash,
        role: UserRole.MEMBER,
        createdAt: new Date(),
      };
      usersRepository.findByEmail.mockResolvedValue(user);
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = await service.login(dto);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.expiresIn).toBe(900);
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(accessTokenService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.MEMBER,
      });
    });

    it('persists a hash of the refresh token, never the raw value (AC4)', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        passwordHash,
        role: UserRole.MEMBER,
        createdAt: new Date(),
      });
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = await service.login(dto);

      const [createArg] = refreshTokensRepository.create.mock.calls[0];
      expect(createArg.tokenHash).not.toBe(result.refreshToken);
      expect(createArg.userId).toBe('user-1');
      expect(createArg.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects an unknown email with a uniform 401 (AC3)', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(refreshTokensRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with the same uniform 401 (AC3)', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        passwordHash,
        role: UserRole.MEMBER,
        createdAt: new Date(),
      });

      await expect(
        service.login({ ...dto, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('unknown-email and wrong-password failures throw the identical error message (AC3)', async () => {
      usersRepository.findByEmail.mockResolvedValueOnce(null);
      let unknownEmailMessage = '';
      try {
        await service.login(dto);
      } catch (error) {
        unknownEmailMessage = (error as Error).message;
      }

      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValueOnce({
        id: 'user-1',
        email: 'ada@example.com',
        passwordHash,
        role: UserRole.MEMBER,
        createdAt: new Date(),
      });
      let wrongPasswordMessage = '';
      try {
        await service.login({ ...dto, password: 'wrong-password' });
      } catch (error) {
        wrongPasswordMessage = (error as Error).message;
      }

      expect(unknownEmailMessage).toBe(wrongPasswordMessage);
      expect(unknownEmailMessage.length).toBeGreaterThan(0);
    });

    it('still hashes/verifies a password even when the user does not exist (AC3 timing mitigation)', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- spying on the CJS module instance shared with password-hasher.util
      const argon2 = require('argon2') as typeof import('argon2');
      const verifySpy = jest.spyOn(argon2, 'verify');

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(verifySpy).toHaveBeenCalled();
      verifySpy.mockRestore();
    });
  });

  describe('refresh', () => {
    const dto: RefreshDto = { refreshToken: 'a-raw-refresh-token' };

    it('issues a new access token for a valid, unrevoked, unexpired refresh token (AC4)', async () => {
      refreshTokensRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'irrelevant-in-this-mock',
        expiresAt: new Date(Date.now() + 60_000),
        revoked: false,
        createdAt: new Date(),
      });
      usersRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        passwordHash: 'irrelevant',
        role: UserRole.MEMBER,
        createdAt: new Date(),
      });

      const result = await service.refresh(dto);

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        expiresIn: 900,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(accessTokenService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.MEMBER,
      });
    });

    it('rejects an unknown refresh token with 401 (AC4)', async () => {
      refreshTokensRepository.findByTokenHash.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a revoked refresh token with 401 (AC4)', async () => {
      refreshTokensRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'irrelevant',
        expiresAt: new Date(Date.now() + 60_000),
        revoked: true,
        createdAt: new Date(),
      });

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token with 401 (AC4)', async () => {
      refreshTokensRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'irrelevant',
        expiresAt: new Date(Date.now() - 60_000),
        revoked: false,
        createdAt: new Date(),
      });

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the referenced user no longer exists', async () => {
      refreshTokensRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'irrelevant',
        expiresAt: new Date(Date.now() + 60_000),
        revoked: false,
        createdAt: new Date(),
      });
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
