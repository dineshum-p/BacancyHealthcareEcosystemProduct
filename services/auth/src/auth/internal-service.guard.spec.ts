import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceGuard } from './internal-service.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('InternalServiceGuard', () => {
  const guard = new InternalServiceGuard({
    internalServiceKey: 'test-internal-service-key',
  });

  it('allows a request presenting the exact configured key', () => {
    const context = makeContext({
      'x-internal-service-key': 'test-internal-service-key',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with a wrong key', () => {
    const context = makeContext({ 'x-internal-service-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request with no key header at all', () => {
    const context = makeContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request with an empty-string key', () => {
    const context = makeContext({ 'x-internal-service-key': '' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
