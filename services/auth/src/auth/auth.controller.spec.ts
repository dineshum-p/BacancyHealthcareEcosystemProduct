import type {
  AuthTokens,
  MfaActivation,
  MfaEnrollment,
  RegisteredUser,
} from '@hep/shared-types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from './user-role.enum';
import { RequestWithAuth } from './request-with-auth.interface';

describe('AuthController', () => {
  let service: jest.Mocked<AuthService>;
  let controller: AuthController;

  beforeEach(() => {
    service = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      enrollMfa: jest.fn(),
      verifyMfaEnrollment: jest.fn(),
      completeMfaLogin: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
    controller = new AuthController(service);
  });

  it('delegates registration to the service', async () => {
    const dto = { email: 'ada@example.com', password: 'super-secret-1' };
    const created: RegisteredUser = {
      id: 'user-1',
      email: 'ada@example.com',
      role: UserRole.MEMBER,
      createdAt: new Date().toISOString(),
    };
    service.register.mockResolvedValue(created);

    await expect(controller.register(dto)).resolves.toBe(created);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login to the service', async () => {
    const dto = { email: 'ada@example.com', password: 'super-secret-1' };
    const tokens: AuthTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    };
    service.login.mockResolvedValue(tokens);

    await expect(controller.login(dto)).resolves.toBe(tokens);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.login).toHaveBeenCalledWith(dto);
  });

  it('delegates refresh to the service', async () => {
    const dto = { refreshToken: 'raw-token' };
    const response = { accessToken: 'access', expiresIn: 900 };
    service.refresh.mockResolvedValue(response);

    await expect(controller.refresh(dto)).resolves.toBe(response);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.refresh).toHaveBeenCalledWith(dto);
  });

  it('returns an mfa_required challenge from login when the service reports one', async () => {
    const dto = { email: 'ada@example.com', password: 'super-secret-1' };
    service.login.mockResolvedValue({
      mfaRequired: true,
      mfaChallengeToken: 'challenge.jwt.token',
    });

    await expect(controller.login(dto)).resolves.toEqual({
      mfaRequired: true,
      mfaChallengeToken: 'challenge.jwt.token',
    });
  });

  function makeAuthenticatedRequest(userId: string): RequestWithAuth {
    return {
      user: { userId, tenantId: 'tenant-1', role: UserRole.MEMBER },
    } as unknown as RequestWithAuth;
  }

  it('delegates mfa/enroll to the service using the authenticated user id', async () => {
    const enrollment: MfaEnrollment = {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/Acme:ada@example.com?secret=JBSWY3DPEHPK3PXP',
    };
    service.enrollMfa.mockResolvedValue(enrollment);

    await expect(
      controller.enrollMfa(makeAuthenticatedRequest('user-1')),
    ).resolves.toBe(enrollment);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.enrollMfa).toHaveBeenCalledWith('user-1');
  });

  it('mfa/enroll throws if AccessTokenGuard did not populate request.user', () => {
    const request = {} as RequestWithAuth;

    expect(() => controller.enrollMfa(request)).toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.enrollMfa).not.toHaveBeenCalled();
  });

  it('delegates mfa/verify to the service using the authenticated user id and the dto', async () => {
    const dto = { totpCode: '123456' };
    const activation: MfaActivation = { recoveryCodes: ['AAAAA-11111'] };
    service.verifyMfaEnrollment.mockResolvedValue(activation);

    await expect(
      controller.verifyMfaEnrollment(makeAuthenticatedRequest('user-1'), dto),
    ).resolves.toBe(activation);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.verifyMfaEnrollment).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates mfa/login-verify to the service', async () => {
    const dto = {
      mfaChallengeToken: 'challenge.jwt.token',
      totpCode: '123456',
    };
    const tokens: AuthTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    };
    service.completeMfaLogin.mockResolvedValue(tokens);

    await expect(controller.completeMfaLogin(dto)).resolves.toBe(tokens);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.completeMfaLogin).toHaveBeenCalledWith(dto);
  });
});
