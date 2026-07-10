import { renderTemplate } from './render-template.util';

describe('renderTemplate', () => {
  it('substitutes a single {{variable}}', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Ada' })).toBe(
      'Hello Ada!',
    );
  });

  it('substitutes multiple distinct variables', () => {
    expect(
      renderTemplate('{{greeting}}, {{name}}! Welcome to {{tenant}}.', {
        greeting: 'Hi',
        name: 'Ada',
        tenant: 'Acme',
      }),
    ).toBe('Hi, Ada! Welcome to Acme.');
  });

  it('substitutes the same variable used more than once', () => {
    expect(renderTemplate('{{name}} {{name}}', { name: 'Ada' })).toBe(
      'Ada Ada',
    );
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('Hello {{ name }}!', { name: 'Ada' })).toBe(
      'Hello Ada!',
    );
  });

  it('replaces an unknown/missing variable with an empty string rather than throwing', () => {
    expect(renderTemplate('Hello {{name}}!', {})).toBe('Hello !');
  });

  it('leaves unmatched braces without a valid identifier untouched', () => {
    expect(renderTemplate('{{ }} and {{1abc}}', { name: 'Ada' })).toBe(
      '{{ }} and {{1abc}}',
    );
  });

  it('never evaluates the substituted value as code (plain string interpolation only)', () => {
    const malicious = "'; process.exit(1); //";
    expect(renderTemplate('data: {{payload}}', { payload: malicious })).toBe(
      `data: ${malicious}`,
    );
  });

  it('coerces non-string primitive values to their string form', () => {
    expect(renderTemplate('count: {{count}}', { count: 3 })).toBe('count: 3');
  });

  it('returns the template unchanged when it has no placeholders', () => {
    expect(renderTemplate('Plain text.', { name: 'Ada' })).toBe('Plain text.');
  });
});
