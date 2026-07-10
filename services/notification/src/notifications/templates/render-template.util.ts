/**
 * Matches `{{ variableName }}` (whitespace around the name is tolerated).
 * Deliberately restricted to `[a-zA-Z0-9_]+` for the variable NAME so this
 * can never be tricked into matching something structurally unexpected;
 * an unmatched pattern (e.g. `{{1abc}}`, whose name starts with a digit) is
 * left in the output untouched rather than partially substituted.
 */
const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

/**
 * Minimal, safe `{{variable}}` substitution against a flat, caller-supplied
 * `data` object -- deliberately NOT a full templating engine (no
 * conditionals/loops/helpers, no `eval`, no function construction from the
 * template string or the data values). `data` here is effectively
 * untrusted-input-into-output (a caller of `POST /notifications` supplies
 * both the templateId AND the data interpolated into the message body that
 * is ultimately sent to a real person), so every substitution is plain
 * string concatenation only -- there is no code path from a data value back
 * into template syntax.
 *
 * A referenced variable missing from `data` is replaced with an empty
 * string (not left as literal `{{...}}`, and not thrown) -- a reasonable,
 * documented default for a template registry with no separate
 * per-template "required variables" schema in this ticket's scope.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, name: string) =>
    stringifyTemplateValue(data[name]),
  );
}

/**
 * Coerces a single substitution value to its display string. Restricted to
 * primitives (string/number/boolean) -- anything else (`object`, `undefined`,
 * `null`) becomes an empty string rather than risking a meaningless
 * `[object Object]` leaking into an outbound message.
 */
function stringifyTemplateValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}
