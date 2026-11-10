const SENSITIVE =
  /secret|token|password|authorization|api[_-]?key|cursor_api_key|credential/i;

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (SENSITIVE.test(value)) return "[redacted]";
    return value.replace(
      /(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
      "[redacted]",
    );
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE.test(key) ? "[redacted]" : redactValue(item);
    }
    return out;
  }
  return value;
}

export function redactRecord(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redactValue(payload) as Record<string, unknown>;
}
