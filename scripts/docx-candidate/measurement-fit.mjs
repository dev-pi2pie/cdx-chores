/** Processing expires at its deadline; the complete API retains its cleanup window. */
export function measurementWithinTime(processingMilliseconds, apiMilliseconds, processingLimit) {
  return (
    Number.isFinite(processingMilliseconds) &&
    processingMilliseconds >= 0 &&
    processingMilliseconds < processingLimit &&
    apiMilliseconds.every((value) => Number.isFinite(value) && value >= 0 && value <= 6_000)
  );
}
