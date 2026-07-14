import { JwtService } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';

describe('AccessTokenService', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('verifies a token signed with the configured secret', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const jwtService = new JwtService();
    const token = jwtService.sign(
      { userId: 'u1', tenantId: 't1', role: 'staff' },
      { secret: 'test-secret', algorithm: 'HS256' },
    );
    const service = new AccessTokenService(jwtService);

    expect(service.verify(token)).toMatchObject({
      userId: 'u1',
      tenantId: 't1',
      role: 'staff',
    });
  });

  it('throws for a token signed with a different secret', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const jwtService = new JwtService();
    const token = jwtService.sign(
      { userId: 'u1', tenantId: 't1', role: 'staff' },
      { secret: 'wrong-secret', algorithm: 'HS256' },
    );
    const service = new AccessTokenService(jwtService);

    expect(() => service.verify(token)).toThrow();
  });
});
