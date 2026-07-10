import { JwtService } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';

/**
 * `services/notification` never signs tokens (only `services/auth` does),
 * so these tests sign with a plain `JwtService` standing in for
 * `services/auth`'s own `AccessTokenService.sign` -- the point being proven
 * is that THIS service's verify-only `AccessTokenService` independently
 * verifies a token signed elsewhere, using the same secret/algorithm
 * convention.
 */
describe('AccessTokenService (verify-only)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('verifies a token signed with the same secret and returns its payload', () => {
    process.env.JWT_ACCESS_SECRET = 'shared-secret';
    const signer = new JwtService();
    const token = signer.sign(
      { userId: 'user-1', tenantId: 'tenant-1', role: 'staff' },
      { secret: 'shared-secret', algorithm: 'HS256', expiresIn: 900 },
    );

    const service = new AccessTokenService(new JwtService());
    expect(service.verify(token)).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'staff',
    });
  });

  it('rejects a token signed with a different secret', () => {
    process.env.JWT_ACCESS_SECRET = 'shared-secret';
    const signer = new JwtService();
    const token = signer.sign(
      { userId: 'user-1', tenantId: 'tenant-1', role: 'staff' },
      { secret: 'a-different-secret', algorithm: 'HS256' },
    );

    const service = new AccessTokenService(new JwtService());
    expect(() => service.verify(token)).toThrow();
  });

  it('pins verification to HS256 and rejects an alg:none token', () => {
    process.env.JWT_ACCESS_SECRET = 'shared-secret';
    const service = new AccessTokenService(new JwtService());

    const base64url = (obj: unknown): string =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const forgedToken = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      userId: 'attacker',
      tenantId: 'tenant-1',
      role: 'super_admin',
    })}.`;

    expect(() => service.verify(forgedToken)).toThrow();
  });

  it('rejects an expired token', async () => {
    process.env.JWT_ACCESS_SECRET = 'shared-secret';
    const signer = new JwtService();
    const token = signer.sign(
      { userId: 'user-1', tenantId: 'tenant-1', role: 'staff' },
      { secret: 'shared-secret', algorithm: 'HS256', expiresIn: 1 },
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const service = new AccessTokenService(new JwtService());
    expect(() => service.verify(token)).toThrow();
  });
});
