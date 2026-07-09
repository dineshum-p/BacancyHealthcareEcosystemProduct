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
      role: UserRole.STAFF,
    });

    expect(expiresIn).toBe(900);
    const decoded = service.verify(token);
    expect(decoded).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });
  });

  it('rejects a token signed with a different secret', () => {
    process.env.JWT_ACCESS_SECRET = 'secret-a';
    const service = new AccessTokenService(new JwtService());
    const { token } = service.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });

    process.env.JWT_ACCESS_SECRET = 'secret-b';
    expect(() => service.verify(token)).toThrow();
  });

  it('pins signing/verification to HS256 and rejects an alg:none token', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const service = new AccessTokenService(new JwtService());

    // Forge a token with `alg: none` (no signature) carrying an arbitrary
    // payload -- this must never verify, regardless of secret.
    const base64url = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const forgedToken = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      userId: 'attacker',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    })}.`;

    expect(() => service.verify(forgedToken)).toThrow();
  });

  it('rejects an expired token', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '1';
    const service = new AccessTokenService(new JwtService());
    const { token } = service.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(() => service.verify(token)).toThrow();
  });
});
