export function jsonArrayValue<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (typeof value !== "string") return [];

  let current: unknown = value;

  for (let depth = 0; depth < 2; depth += 1) {
    if (Array.isArray(current)) return current as T[];

    if (typeof current !== "string") return [];

    try {
      current = JSON.parse(current);
    } catch {
      return [];
    }
  }

  return Array.isArray(current) ? (current as T[]) : [];
}
