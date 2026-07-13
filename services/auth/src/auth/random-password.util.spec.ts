import { generateRandomPassword } from './random-password.util';

describe('generateRandomPassword', () => {
  it('generates a long, high-entropy string', () => {
    const password = generateRandomPassword();

    expect(typeof password).toBe('string');
    expect(password.length).toBeGreaterThanOrEqual(32);
  });

  it('generates a different value on each call', () => {
    expect(generateRandomPassword()).not.toBe(generateRandomPassword());
  });
});
