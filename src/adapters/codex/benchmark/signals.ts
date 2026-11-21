/** Keep the initiating signal's exit policy while the benchmark finishes cleanup. */
export function handleBenchmarkSignals(onForeground: () => void) {
  let first: "SIGHUP" | "SIGINT" | "SIGTERM" | undefined;
  function foreground(signal: "SIGINT" | "SIGTERM"): void {
    if (first) return;
    first = signal;
    onForeground();
  }
  const interrupt = () => foreground("SIGINT");
  const terminate = () => foreground("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  return {
    acceptHangup() {
      first ??= "SIGHUP";
      return first === "SIGHUP";
    },
    get hungUp() {
      return first === "SIGHUP";
    },
    get exitCode() {
      if (first === "SIGINT") return 130;
      if (first === "SIGTERM") return 143;
      return undefined;
    },
    release() {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    },
  };
}
