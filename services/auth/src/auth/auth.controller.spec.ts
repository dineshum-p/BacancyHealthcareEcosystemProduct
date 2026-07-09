import type { AuthTokens, RegisteredUser } from '@hep/shared-types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from './user-role.enum';

describe('AuthController', () => {
  let service: jest.Mocked<AuthService>;
  let controller: AuthController;

  beforeEach(() => {
    service = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
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
});
