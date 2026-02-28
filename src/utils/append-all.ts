export function appendAll<T>(target: T[], source: readonly T[]): void {
  for (const item of source) {
    target.push(item);
  }
}
