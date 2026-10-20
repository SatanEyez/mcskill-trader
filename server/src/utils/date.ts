/** Единый формат дат в API: ISO-8601 в UTC. */
export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
