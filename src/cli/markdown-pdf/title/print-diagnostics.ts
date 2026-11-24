// WeasyPrint's debug formatter inserts the logger, file, line and function
// before each message. Only normal diagnostics belong in the CLI output.
const logRecord = /^(DEBUG|INFO|WARNING|ERROR|CRITICAL): (?:\S+ \S+:\d+ \([^)]+\): )?(.*)$/u;
const failedFontSource =
  /^Failed to (?:load (?:font at|local font)|get matching local font for|handle woff font at) (?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/u;

export function readTitlePrintDiagnostics(stderr: string, renderSucceeded: boolean) {
  const failures = new Map<string, number>();
  const messages: string[] = [];
  let previousFontSource: string | undefined;
  let unidentifiedFace = false;
  let debugRecord = false;
  let debugTraceback = false;
  const count = (key: string) => failures.set(key, (failures.get(key) ?? 0) + 1);

  for (const line of stderr.split(/\r?\n/u)) {
    const record = logRecord.exec(line);
    if (!record) {
      // Handled exceptions are logged with a traceback at DEBUG level.
      // Leave independent stderr diagnostics and fatal renderer errors intact.
      if (line.startsWith("Traceback (most recent call last):"))
        debugTraceback = debugRecord && renderSucceeded;
      if (!debugTraceback) messages.push(line);
      continue;
    }
    const [, level, message = ""] = record;
    debugRecord = level === "DEBUG";
    debugTraceback = false;
    const source = debugRecord ? failedFontSource.exec(message)?.[0] : undefined;
    if (source) count(source);
    if (!debugRecord && level !== "INFO") {
      const diagnostic = `${level}: ${message}`;
      messages.push(diagnostic);
      if (/^Font-face .+ cannot be loaded\b/u.test(message)) {
        // The family warning alone cannot distinguish two faces. WeasyPrint
        // reports the last failed source immediately before this warning.
        if (previousFontSource) count(diagnostic + "\n" + previousFontSource);
        else unidentifiedFace = true;
      } else if (/^Failed to load\b/u.test(message)) {
        count(diagnostic);
      }
    }
    previousFontSource = source;
  }
  return { stderr: messages.join("\n"), failures: unidentifiedFace ? undefined : failures };
}
