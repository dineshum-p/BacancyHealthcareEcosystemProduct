import { JwtService } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';
import { UserRole } from './user-role.enum';

describe('AccessTokenService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('signs a JWT whose payload contains userId, tenantId and role (AC5)', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
    const service = new AccessTokenService(new JwtService());

    const { token, expiresIn } = service.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.MEMBER,
    });

    expect(expiresIn).toBe(900);
    const decoded = service.verify(token);
    expect(decoded).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.MEMBER,
    });
  });

  it('rejects a token signed with a different secret', () => {
    process.env.JWT_ACCESS_SECRET = 'secret-a';
    const service = new AccessTokenService(new JwtService());
    const { token } = service.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.MEMBER,
    });

    process.env.JWT_ACCESS_SECRET = 'secret-b';
    expect(() => service.verify(token)).toThrow();
  });

  it('rejects an expired token', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '1';
    const service = new AccessTokenService(new JwtService());
    const { token } = service.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.MEMBER,
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(() => service.verify(token)).toThrow();
  });
});
