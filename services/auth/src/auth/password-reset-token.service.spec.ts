import { JwtService } from '@nestjs/jwt';
import { PasswordResetTokenService } from './password-reset-token.service';
import { AccessTokenService } from './access-token.service';
import { MfaChallengeTokenService } from './mfa-challenge-token.service';
import { UserRole } from './user-role.enum';

describe('PasswordResetTokenService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('signs and verifies a password-reset token carrying userId/tenantId/purpose', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const service = new PasswordResetTokenService(new JwtService());

    const { token, expiresIn } = service.sign('user-1', 'tenant-1');
    const payload = service.verify(token);

    expect(payload).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'password-reset-required',
    });
    expect(expiresIn).toBeGreaterThan(0);
  });

  it('rejects a token signed under a different JWT_ACCESS_SECRET', () => {
    process.env.JWT_ACCESS_SECRET = 'secret-a';
    const service = new PasswordResetTokenService(new JwtService());
    const { token } = service.sign('user-1', 'tenant-1');

    process.env.JWT_ACCESS_SECRET = 'secret-b';
    expect(() => service.verify(token)).toThrow();
  });

  /**
   * BAC-49 BLOCKER fix: the whole point of this service. Confirmed the
   * regression this closes -- before this fix, `login()` reused
   * `accessTokenService.sign` unchanged, so this token was a normal, fully-
   * usable access token, valid Bearer credential for EVERY
   * `AccessTokenGuard`-protected route (e.g. `GET /auth/roles`), not just
   * `POST /auth/reset-temporary-password`.
   */
  it('is NOT accepted by AccessTokenService.verify (distinct secret/claims -- cannot be replayed as a bearer access token)', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const passwordResetTokenService = new PasswordResetTokenService(
      new JwtService(),
    );
    const accessTokenService = new AccessTokenService(new JwtService());
    const { token } = passwordResetTokenService.sign('user-1', 'tenant-1');

    expect(() => accessTokenService.verify(token)).toThrow();
  });

  it('a real access token is NOT accepted by PasswordResetTokenService.verify', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const passwordResetTokenService = new PasswordResetTokenService(
      new JwtService(),
    );
    const accessTokenService = new AccessTokenService(new JwtService());
    const { token: accessToken } = accessTokenService.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });

    expect(() => passwordResetTokenService.verify(accessToken)).toThrow();
  });

  it('is NOT accepted by MfaChallengeTokenService.verify (independently distinct secret)', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const passwordResetTokenService = new PasswordResetTokenService(
      new JwtService(),
    );
    const mfaChallengeTokenService = new MfaChallengeTokenService(
      new JwtService(),
    );
    const { token } = passwordResetTokenService.sign('user-1', 'tenant-1');

    expect(() => mfaChallengeTokenService.verify(token)).toThrow();
  });
});
