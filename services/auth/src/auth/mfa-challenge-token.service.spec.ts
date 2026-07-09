import { JwtService } from '@nestjs/jwt';
import { MfaChallengeTokenService } from './mfa-challenge-token.service';
import { AccessTokenService } from './access-token.service';
import { UserRole } from './user-role.enum';

describe('MfaChallengeTokenService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('signs and verifies a challenge token carrying userId/tenantId/purpose', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const service = new MfaChallengeTokenService(new JwtService());

    const token = service.sign('user-1', 'tenant-1');
    const payload = service.verify(token);

    expect(payload).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'mfa-challenge',
    });
  });

  it('rejects a token signed under a different JWT_ACCESS_SECRET', () => {
    process.env.JWT_ACCESS_SECRET = 'secret-a';
    const service = new MfaChallengeTokenService(new JwtService());
    const token = service.sign('user-1', 'tenant-1');

    process.env.JWT_ACCESS_SECRET = 'secret-b';
    expect(() => service.verify(token)).toThrow();
  });

  it('rejects an expired challenge token', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const service = new MfaChallengeTokenService(new JwtService());
    const token = service.sign('user-1', 'tenant-1', 1);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(() => service.verify(token)).toThrow();
  });

  it('is NOT accepted by AccessTokenService.verify (distinct secret/claims -- cannot be replayed as a bearer access token)', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const challengeService = new MfaChallengeTokenService(new JwtService());
    const accessTokenService = new AccessTokenService(new JwtService());
    const challengeToken = challengeService.sign('user-1', 'tenant-1');

    expect(() => accessTokenService.verify(challengeToken)).toThrow();
  });

  it('a real access token is NOT accepted by MfaChallengeTokenService.verify', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const challengeService = new MfaChallengeTokenService(new JwtService());
    const accessTokenService = new AccessTokenService(new JwtService());
    const { token: accessToken } = accessTokenService.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });

    expect(() => challengeService.verify(accessToken)).toThrow();
  });
});
