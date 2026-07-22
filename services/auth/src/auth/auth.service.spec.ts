import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthTokens, MfaChallenge } from '@hep/shared-types';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { MfaRecoveryCodesRepository } from './mfa-recovery-codes.repository';
import { AccessTokenService } from './access-token.service';
import { MfaChallengeTokenService } from './mfa-challenge-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { Tenant } from '../tenants/tenant.entity';
import { UserRole } from './user-role.enum';
import { MfaStatus } from './mfa-status.enum';
import { User } from './user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { hashPassword, verifyPassword } from './password-hasher.util';
import { encryptTotpSecret } from './totp-secret-cipher.util';
import { currentTotpStep, generateTotpSecret } from './totp.util';
import { verifyRecoveryCode } from './recovery-code.util';
import { RegisterDto } from './dto/register.dto';
import { PatientSignUpDto } from './dto/patient-sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

/** BAC-6: default-MFA-off user literal, so BAC-5 tests don't need to know about MFA fields individually. */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    passwordHash: 'irrelevant',
    role: UserRole.STAFF,
    createdAt: new Date(),
    mfaStatus: MfaStatus.NONE,
    mfaSecretEncrypted: null,
    mfaLastUsedStep: null,
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    gender: null,
    phone: null,
    address: null,
    mustResetPassword: false,
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersRepository: jest.Mocked<UsersRepository>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let mfaRecoveryCodesRepository: jest.Mocked<MfaRecoveryCodesRepository>;
  let accessTokenService: jest.Mocked<AccessTokenService>;
  let mfaChallengeTokenService: jest.Mocked<MfaChallengeTokenService>;
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
    // Deliberately NOT `dto.email` below (normalized: `ada@example.com`),
    // so the ordinary register() tests exercise the non-owner/default-STAFF
    // path without needing to know about bootstrap-admin resolution at all.
    ownerEmail: 'owner@example.com',
  };

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      updateRole: jest.fn(),
      startMfaEnrollment: jest.fn().mockResolvedValue(undefined),
      activateMfa: jest.fn(),
      recordMfaStepIfNewer: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    refreshTokensRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;
    mfaRecoveryCodesRepository = {
      replaceAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MfaRecoveryCodesRepository>;
    accessTokenService = {
      sign: jest
        .fn()
        .mockReturnValue({ token: 'signed.jwt.token', expiresIn: 900 }),
      verify: jest.fn(),
    } as unknown as jest.Mocked<AccessTokenService>;
    mfaChallengeTokenService = {
      sign: jest.fn().mockReturnValue('challenge.jwt.token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<MfaChallengeTokenService>;
    authSchemaProvisioner = {
      ensureProvisioned: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthSchemaProvisioner>;
    tenantContext = {
      getTenant: jest.fn().mockReturnValue(tenant),
    } as unknown as jest.Mocked<TenantContextService>;

    service = new AuthService(
      usersRepository,
      refreshTokensRepository,
      mfaRecoveryCodesRepository,
      accessTokenService,
      mfaChallengeTokenService,
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
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.register(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });

    it("normalizes the email to lowercase and defaults role to staff (AC1, BAC-7) when the email does not match the tenant's ownerEmail", async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.register(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          role: UserRole.STAFF,
        }),
      );
      expect(result).toMatchObject({
        email: 'ada@example.com',
        role: UserRole.STAFF,
      });
      expect(typeof result.id).toBe('string');
      expect(typeof result.createdAt).toBe('string');
    });

    it('never returns the password hash', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.register(dto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain(dto.password);
    });

    it('stores an argon2 hash, not the plaintext password', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
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

    describe('bootstrap-admin resolution (BAC-7)', () => {
      it("assigns SUPER_ADMIN when the registering email exactly matches the tenant's ownerEmail", async () => {
        tenantContext.getTenant.mockReturnValue({
          ...tenant,
          ownerEmail: 'ada@example.com',
        });
        usersRepository.create.mockImplementation((user) =>
          Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
        );

        const result = await service.register(dto);

        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(usersRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ role: UserRole.SUPER_ADMIN }),
        );
        expect(result.role).toBe(UserRole.SUPER_ADMIN);
      });

      it('assigns SUPER_ADMIN when the registering email matches ownerEmail case-insensitively', async () => {
        tenantContext.getTenant.mockReturnValue({
          ...tenant,
          ownerEmail: 'ADA@EXAMPLE.COM',
        });
        usersRepository.create.mockImplementation((user) =>
          Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
        );

        const result = await service.register(dto);

        expect(result.role).toBe(UserRole.SUPER_ADMIN);
      });

      it("assigns the default STAFF role when the registering email does NOT match ownerEmail, even when it is genuinely the tenant's first registration", async () => {
        usersRepository.count.mockResolvedValue(0);
        tenantContext.getTenant.mockReturnValue({
          ...tenant,
          ownerEmail: 'someone-else@example.com',
        });
        usersRepository.create.mockImplementation((user) =>
          Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
        );

        const result = await service.register(dto);

        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(usersRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ role: UserRole.STAFF }),
        );
        expect(result.role).toBe(UserRole.STAFF);
      });

      it('assigns the default STAFF role when the tenant has no ownerEmail (a pre-BAC-7 row)', async () => {
        tenantContext.getTenant.mockReturnValue({
          ...tenant,
          ownerEmail: null,
        });
        usersRepository.create.mockImplementation((user) =>
          Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
        );

        const result = await service.register(dto);

        expect(result.role).toBe(UserRole.STAFF);
      });

      it('resolves the tenant AFTER ensuring the schema exists', async () => {
        usersRepository.create.mockImplementation((user) =>
          Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
        );

        await service.register(dto);

        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
          'tenant_acme',
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(tenantContext.getTenant).toHaveBeenCalled();
      });
    });
  });

  describe('registerPatient (BAC-42)', () => {
    const dto: PatientSignUpDto = {
      email: 'Patient@Example.com',
      password: 'super-secret-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1990-05-12',
    };

    it('provisions the tenant schema before creating the user', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(
          makeUser({
            ...user,
            createdAt: new Date(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            dateOfBirth: user.dateOfBirth ?? null,
          }),
        ),
      );

      await service.registerPatient(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });

    it('normalizes the email, always assigns the PATIENT role (never STAFF/owner promotion), and persists the identity fields', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(
          makeUser({
            ...user,
            createdAt: new Date(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            dateOfBirth: user.dateOfBirth ?? null,
          }),
        ),
      );

      const result = await service.registerPatient(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'patient@example.com',
          role: UserRole.PATIENT,
          firstName: 'Ada',
          lastName: 'Lovelace',
          dateOfBirth: '1990-05-12',
        }),
      );
      expect(result).toMatchObject({
        email: 'patient@example.com',
        role: UserRole.PATIENT,
      });
    });

    it('is NOT subject to bootstrap-admin (ownerEmail) promotion, unlike register()', async () => {
      tenantContext.getTenant.mockReturnValue({
        ...tenant,
        ownerEmail: 'patient@example.com',
      });
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(
          makeUser({
            ...user,
            createdAt: new Date(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            dateOfBirth: user.dateOfBirth ?? null,
          }),
        ),
      );

      const result = await service.registerPatient(dto);

      expect(result.role).toBe(UserRole.PATIENT);
    });

    it('stores an argon2 hash, not the plaintext password', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(
          makeUser({
            ...user,
            createdAt: new Date(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            dateOfBirth: user.dateOfBirth ?? null,
          }),
        ),
      );

      await service.registerPatient(dto);

      const [createArg] = usersRepository.create.mock.calls[0];
      expect(createArg.passwordHash).not.toBe(dto.password);
      expect(createArg.passwordHash.startsWith('$argon2')).toBe(true);
    });

    it("never returns the password hash, and does not issue any tokens (matches register()'s no-auto-login behaviour)", async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(
          makeUser({
            ...user,
            createdAt: new Date(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            dateOfBirth: user.dateOfBirth ?? null,
          }),
        ),
      );

      const result = await service.registerPatient(dto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(JSON.stringify(result)).not.toContain(dto.password);
    });

    it('translates a duplicate email into ConflictException (409), same as register()', async () => {
      usersRepository.create.mockRejectedValue(
        new EmailAlreadyExistsError('patient@example.com'),
      );

      await expect(service.registerPatient(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('seedClinicAdmin (BAC-12)', () => {
    const dto = { email: 'New.Admin@Example.com' };

    it('provisions the tenant schema before creating the user', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.seedClinicAdmin(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });

    it('normalizes the email and always assigns the clinic_admin role', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.seedClinicAdmin(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.admin@example.com',
          role: UserRole.CLINIC_ADMIN,
        }),
      );
      expect(result).toMatchObject({
        email: 'new.admin@example.com',
        role: UserRole.CLINIC_ADMIN,
      });
    });

    it('stores an argon2 hash of the seed password, never a caller-supplied one', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.seedClinicAdmin(dto);

      const [createArg] = usersRepository.create.mock.calls[0];
      expect(createArg.passwordHash.startsWith('$argon2')).toBe(true);
    });

    it('hashes the known dev seed password under test/development so the admin can log in', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.seedClinicAdmin(dto);

      const [createArg] = usersRepository.create.mock.calls[0];
      // Jest runs with NODE_ENV=test, so the seeded hash must verify against
      // the committed dev password (DEV_SEED_ADMIN_PASSWORD = 'Test@123').
      await expect(
        verifyPassword(createArg.passwordHash, 'Test@123'),
      ).resolves.toBe(true);
    });

    it('never returns the password hash', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.seedClinicAdmin(dto);

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('translates a duplicate email into ConflictException (409)', async () => {
      usersRepository.create.mockRejectedValue(
        new EmailAlreadyExistsError('new.admin@example.com'),
      );

      await expect(service.seedClinicAdmin(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propagates unrelated repository errors unchanged', async () => {
      usersRepository.create.mockRejectedValue(new Error('db unreachable'));

      await expect(service.seedClinicAdmin(dto)).rejects.toThrow(
        'db unreachable',
      );
    });
  });

  describe('createProviderAccount (BAC-48)', () => {
    const dto = {
      firstName: 'Grace',
      lastName: 'Hopper',
      dateOfBirth: '1980-01-15',
      gender: 'female' as const,
      email: 'New.Doctor@Example.com',
      phone: '+1-555-0100',
      address: '1 Infinite Loop',
      role: 'provider' as const,
    };

    it('provisions the tenant schema before creating the user', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.createProviderAccount(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(authSchemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });

    it('normalizes the email, always assigns the provider role, and persists the identity fields', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.createProviderAccount(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.doctor@example.com',
          role: UserRole.PROVIDER,
          firstName: 'Grace',
          lastName: 'Hopper',
          dateOfBirth: '1980-01-15',
          gender: 'female',
          phone: '+1-555-0100',
          address: '1 Infinite Loop',
          mustResetPassword: true,
        }),
      );
    });

    it('stores an argon2 hash of a system-generated temporary password, never a caller-supplied one', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      await service.createProviderAccount(dto);

      const [createArg] = usersRepository.create.mock.calls[0];
      expect(createArg.passwordHash.startsWith('$argon2')).toBe(true);
    });

    it('returns the raw temporary password exactly once, and it verifies against the stored hash', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.createProviderAccount(dto);

      expect(typeof result.temporaryPassword).toBe('string');
      expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(32);
      const [createArg] = usersRepository.create.mock.calls[0];
      await expect(
        verifyPassword(createArg.passwordHash, result.temporaryPassword),
      ).resolves.toBe(true);
    });

    it('sets mustResetPassword: true on the response', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.createProviderAccount(dto);

      expect(result.mustResetPassword).toBe(true);
    });

    it('never returns the password hash', async () => {
      usersRepository.create.mockImplementation((user) =>
        Promise.resolve(makeUser({ ...user, createdAt: new Date() })),
      );

      const result = await service.createProviderAccount(dto);

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('translates a duplicate email into ConflictException (409)', async () => {
      usersRepository.create.mockRejectedValue(
        new EmailAlreadyExistsError('new.doctor@example.com'),
      );

      await expect(service.createProviderAccount(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propagates unrelated repository errors unchanged', async () => {
      usersRepository.create.mockRejectedValue(new Error('db unreachable'));

      await expect(service.createProviderAccount(dto)).rejects.toThrow(
        'db unreachable',
      );
    });
  });

  describe('listRoles (AC1)', () => {
    it('returns all five seeded roles with their permission sets (BAC-41 adds patient)', () => {
      const roles = service.listRoles();

      expect(roles.map((r) => r.role).sort()).toEqual(
        [
          UserRole.SUPER_ADMIN,
          UserRole.CLINIC_ADMIN,
          UserRole.PROVIDER,
          UserRole.STAFF,
          UserRole.PATIENT,
        ].sort(),
      );
      // `roles` is typed against `@hep/shared-types`' plain string-literal
      // `UserRole`, not this service's own enum, so these comparisons use
      // the raw string values rather than the enum members.
      const superAdmin = roles.find((r) => r.role === 'super_admin');
      expect(superAdmin?.permissions).toContain('manage_user_roles');
      const staff = roles.find((r) => r.role === 'staff');
      expect(staff?.permissions).not.toContain('manage_user_roles');
      // BAC-41: patient is default-deny -- no permissions inherited from
      // any staff-side role.
      const patient = roles.find((r) => r.role === 'patient');
      expect(patient?.permissions).toEqual([]);
    });
  });

  describe('updateUserRole (AC2/AC3/AC4)', () => {
    it('updates the role and returns the updated user, scoped to the current tenant', async () => {
      usersRepository.updateRole.mockResolvedValue(
        makeUser({ id: 'user-2', role: UserRole.CLINIC_ADMIN }),
      );

      const result = await service.updateUserRole(
        'user-2',
        UserRole.CLINIC_ADMIN,
      );

      expect(result).toMatchObject({
        id: 'user-2',
        role: UserRole.CLINIC_ADMIN,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.updateRole).toHaveBeenCalledWith(
        'user-2',
        UserRole.CLINIC_ADMIN,
      );
    });

    it('throws NotFoundException when the user does not exist in the current tenant (including cross-tenant ids)', async () => {
      usersRepository.updateRole.mockResolvedValue(null);

      await expect(
        service.updateUserRole('someone-elses-id', UserRole.PROVIDER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'Ada@Example.com',
      password: 'correct-password',
    };

    it('issues access + refresh tokens for valid credentials (AC2)', async () => {
      const passwordHash = await hashPassword('correct-password');
      const user: User = makeUser({ passwordHash });
      usersRepository.findByEmail.mockResolvedValue(user);
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = (await service.login(dto)) as AuthTokens;

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.expiresIn).toBe(900);
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(accessTokenService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.STAFF,
      });
    });

    it('persists a hash of the refresh token, never the raw value (AC4)', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = (await service.login(dto)) as AuthTokens;

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
      usersRepository.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

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
      usersRepository.findByEmail.mockResolvedValueOnce(
        makeUser({ passwordHash }),
      );
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
      usersRepository.findById.mockResolvedValue(makeUser());

      const result = await service.refresh(dto);

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        expiresIn: 900,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(accessTokenService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.STAFF,
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

  describe('enrollMfa (AC1)', () => {
    it('generates a secret, returns an otpauth:// URI, and marks MFA pending (not active)', async () => {
      usersRepository.findById.mockResolvedValue(makeUser());

      const result = await service.enrollMfa('user-1');

      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.startMfaEnrollment).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      const [, storedEncryptedSecret] =
        usersRepository.startMfaEnrollment.mock.calls[0];
      expect(storedEncryptedSecret).not.toBe(result.secret);
      expect(storedEncryptedSecret).not.toContain(result.secret);
    });

    it('throws UnauthorizedException when the authenticated user no longer exists', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.enrollMfa('ghost-user')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.startMfaEnrollment).not.toHaveBeenCalled();
    });
  });

  describe('verifyMfaEnrollment (AC2)', () => {
    function makePendingUser(): { user: User; secret: string } {
      const secret = generateTotpSecret();
      const user = makeUser({
        mfaStatus: MfaStatus.PENDING,
        mfaSecretEncrypted: encryptTotpSecret(secret),
        mfaLastUsedStep: null,
      });
      return { user, secret };
    }

    it('activates MFA and returns recovery codes for a valid code against the pending secret', async () => {
      const { user, secret } = makePendingUser();
      usersRepository.findById.mockResolvedValue(user);
      usersRepository.activateMfa.mockResolvedValue(true);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- generating a real code for the pending secret
      const { authenticator } = require('otplib') as typeof import('otplib');
      const dto: MfaVerifyDto = { totpCode: authenticator.generate(secret) };
      // Captured immediately after code generation, not after `await
      // service.verifyMfaEnrollment(...)` below: that call now hashes 10
      // recovery codes with Argon2 (deliberately slow -- BAC-6 review fix),
      // so enough wall-clock time can elapse during it to cross the 30s
      // TOTP step boundary and flake a post-hoc `currentTotpStep()` call.
      const expectedStep = currentTotpStep();

      const result = await service.verifyMfaEnrollment('user-1', dto);

      expect(result.recoveryCodes).toHaveLength(10);
      expect(new Set(result.recoveryCodes).size).toBe(10);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.activateMfa).toHaveBeenCalledWith(
        'user-1',
        expectedStep,
      );
    });

    it('persists only hashes of the recovery codes, never the raw codes', async () => {
      const { user, secret } = makePendingUser();
      usersRepository.findById.mockResolvedValue(user);
      usersRepository.activateMfa.mockResolvedValue(true);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { authenticator } = require('otplib') as typeof import('otplib');
      const dto: MfaVerifyDto = { totpCode: authenticator.generate(secret) };

      const result = await service.verifyMfaEnrollment('user-1', dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(mfaRecoveryCodesRepository.replaceAll).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([expect.any(String)]),
      );
      const [, persistedHashes] =
        mfaRecoveryCodesRepository.replaceAll.mock.calls[0];
      expect(persistedHashes).toHaveLength(result.recoveryCodes.length);
      for (const rawCode of result.recoveryCodes) {
        expect(persistedHashes).not.toContain(rawCode);
      }
      // Each raw code's hash is present (order-preserved) and verifies back
      // to that same code via Argon2 -- not just "some string got stored".
      await Promise.all(
        result.recoveryCodes.map(async (rawCode, index) => {
          await expect(
            verifyRecoveryCode(persistedHashes[index], rawCode),
          ).resolves.toBe(true);
        }),
      );
    });

    it('rejects an invalid code with 401 and does not activate MFA (AC4-style)', async () => {
      const { user } = makePendingUser();
      usersRepository.findById.mockResolvedValue(user);

      await expect(
        service.verifyMfaEnrollment('user-1', { totpCode: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.activateMfa).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(mfaRecoveryCodesRepository.replaceAll).not.toHaveBeenCalled();
    });

    it('rejects with ConflictException when there is no pending enrollment (status none)', async () => {
      usersRepository.findById.mockResolvedValue(makeUser());

      await expect(
        service.verifyMfaEnrollment('user-1', { totpCode: '123456' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects with ConflictException when MFA is already active', async () => {
      usersRepository.findById.mockResolvedValue(
        makeUser({ mfaStatus: MfaStatus.ACTIVE }),
      );

      await expect(
        service.verifyMfaEnrollment('user-1', { totpCode: '123456' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login when MFA is active (AC3)', () => {
    const dto: LoginDto = {
      email: 'Ada@Example.com',
      password: 'correct-password',
    };

    it('returns an mfa_required challenge instead of tokens for valid credentials', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash, mfaStatus: MfaStatus.ACTIVE }),
      );

      const result = (await service.login(dto)) as MfaChallenge;

      expect(result).toEqual({
        mfaRequired: true,
        mfaChallengeToken: 'challenge.jwt.token',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(mfaChallengeTokenService.sign).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(refreshTokensRepository.create).not.toHaveBeenCalled();
    });

    it('still rejects a wrong password with the uniform 401, never reaching the MFA branch', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash, mfaStatus: MfaStatus.ACTIVE }),
      );

      await expect(
        service.login({ ...dto, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(mfaChallengeTokenService.sign).not.toHaveBeenCalled();
    });

    it('does NOT challenge (issues tokens directly) when MFA is only pending, not active', async () => {
      const passwordHash = await hashPassword('correct-password');
      usersRepository.findByEmail.mockResolvedValue(
        makeUser({ passwordHash, mfaStatus: MfaStatus.PENDING }),
      );
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(mfaChallengeTokenService.sign).not.toHaveBeenCalled();
    });
  });

  describe('completeMfaLogin (AC3 + AC4)', () => {
    const challengeDto = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'mfa-challenge' as const,
    };

    function makeActiveUser(): { user: User; secret: string } {
      const secret = generateTotpSecret();
      const user = makeUser({
        mfaStatus: MfaStatus.ACTIVE,
        mfaSecretEncrypted: encryptTotpSecret(secret),
        mfaLastUsedStep: currentTotpStep() - 10,
      });
      return { user, secret };
    }

    function validCodeFor(secret: string): string {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { authenticator } = require('otplib') as typeof import('otplib');
      return authenticator.generate(secret);
    }

    it('exchanges a valid challenge token + correct TOTP code for real tokens (AC3)', async () => {
      const { user, secret } = makeActiveUser();
      mfaChallengeTokenService.verify.mockReturnValue(challengeDto);
      usersRepository.findById.mockResolvedValue(user);
      usersRepository.recordMfaStepIfNewer.mockResolvedValue(true);
      refreshTokensRepository.create.mockImplementation((entry) =>
        Promise.resolve({ ...entry, revoked: false, createdAt: new Date() }),
      );

      const result = await service.completeMfaLogin({
        mfaChallengeToken: 'challenge.jwt.token',
        totpCode: validCodeFor(secret),
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('rejects an invalid TOTP code with 401 and issues no tokens (AC4)', async () => {
      const { user } = makeActiveUser();
      mfaChallengeTokenService.verify.mockReturnValue(challengeDto);
      usersRepository.findById.mockResolvedValue(user);

      await expect(
        service.completeMfaLogin({
          mfaChallengeToken: 'challenge.jwt.token',
          totpCode: '000000',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(refreshTokensRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a reused TOTP code with 401 (AC4 replay prevention)', async () => {
      const { user, secret } = makeActiveUser();
      mfaChallengeTokenService.verify.mockReturnValue(challengeDto);
      usersRepository.findById.mockResolvedValue(user);
      usersRepository.recordMfaStepIfNewer.mockResolvedValue(false);

      await expect(
        service.completeMfaLogin({
          mfaChallengeToken: 'challenge.jwt.token',
          totpCode: validCodeFor(secret),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(refreshTokensRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid/garbage challenge token with 401', async () => {
      mfaChallengeTokenService.verify.mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(
        service.completeMfaLogin({
          mfaChallengeToken: 'garbage',
          totpCode: '123456',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a challenge token minted for a different tenant with 401', async () => {
      mfaChallengeTokenService.verify.mockReturnValue({
        ...challengeDto,
        tenantId: 'a-different-tenant',
      });

      await expect(
        service.completeMfaLogin({
          mfaChallengeToken: 'challenge.jwt.token',
          totpCode: '123456',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usersRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the referenced user is no longer MFA-active', async () => {
      mfaChallengeTokenService.verify.mockReturnValue(challengeDto);
      usersRepository.findById.mockResolvedValue(makeUser());

      await expect(
        service.completeMfaLogin({
          mfaChallengeToken: 'challenge.jwt.token',
          totpCode: '123456',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
