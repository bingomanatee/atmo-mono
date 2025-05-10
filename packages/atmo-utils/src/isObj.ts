export function isObj(obj: unknown): obj is object {
  if (!obj) return false;
  return typeof obj === 'object';
}
