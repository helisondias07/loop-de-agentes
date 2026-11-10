export const EXPECTED_JSON_TEST_COUNT = 6;

export function parseLastJsonObject(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const value = JSON.parse(text) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return value as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParse(trimmed.slice(start, end + 1));
}

export function evaluationPassed(exitCode: number, stdout: string): boolean {
  if (exitCode !== 0) return false;
  const parsed = parseLastJsonObject(stdout);
  return parsed?.ok === true && parsed?.tested === EXPECTED_JSON_TEST_COUNT;
}
