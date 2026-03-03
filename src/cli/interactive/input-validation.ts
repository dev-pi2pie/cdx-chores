export function validateIntegerInput(
  value: string,
  options: { min?: number; allowEmpty?: boolean },
): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.allowEmpty ? true : "Required";
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Must be a non-negative integer";
  }
  const parsed = Number(trimmed);
  const min = options.min ?? 0;
  if (parsed < min) {
    return `Must be >= ${min}`;
  }
  return true;
}
