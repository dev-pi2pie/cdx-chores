export async function withCapturedTimeoutSignals<T>(
  run: (timeouts: number[], signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const originalTimeout = AbortSignal.timeout;
  const timeouts: number[] = [];
  const signal = new AbortController().signal;
  AbortSignal.timeout = ((delay: number) => {
    timeouts.push(delay);
    return signal;
  }) as typeof AbortSignal.timeout;

  try {
    return await run(timeouts, signal);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
}
