const FILE_URL_PATTERN = /\bfile:\/\/[^\s<>"'`]+/giu;
const SCHEME_URL_PATTERN = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"'`]+/gu;
const LOOPBACK_PATTERN =
  /(?:\blocalhost\b|\b127(?:\.\d{1,3}){0,3}\b|\b2130706433\b|\b0x7f000001\b|\[::1\]|(?<![\w:])::1(?![\w:]))(?::\d+)?/giu;
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:[\\/][^\s<>"'`),;]+/gu;
const UNC_PATH_PATTERN = /\\\\[^\s<>"'`),;]+/gu;
const POSIX_LOCAL_PATH_PATTERN =
  /(^|[\s(["'`=])\/(?:Users|private|tmp|var|Volumes|home|mnt|opt|etc|dev|Applications|System|Library)\b[^\s<>"'`),;]*/gu;
const RELATIVE_PATH_PATTERN =
  /(^|[\s(["'`=])(?:(?:\.\.?[/\\])|(?:[A-Za-z0-9._-]+[/\\]))[A-Za-z0-9._/@%+-]+(?:[/\\][A-Za-z0-9._/@%+-]+)*(?:\.[A-Za-z0-9]+)?/gu;
export function escapeMdPdfProjectCodexTerminalText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint > 0x1f && (codePoint < 0x7f || codePoint > 0x9f)) {
      return character;
    }
    const json = JSON.stringify(character);
    return json.length > 3 ? json.slice(1, -1) : `\\u${codePoint.toString(16).padStart(4, "0")}`;
  }).join("");
}

export function sanitizeMdPdfProjectCodexReportText(value: string): string {
  return value
    .replace(FILE_URL_PATTERN, "[redacted-path]")
    .replace(SCHEME_URL_PATTERN, "[redacted-url]")
    .replace(LOOPBACK_PATTERN, "[redacted-host]")
    .replace(WINDOWS_PATH_PATTERN, "[redacted-path]")
    .replace(UNC_PATH_PATTERN, "[redacted-path]")
    .replace(POSIX_LOCAL_PATH_PATTERN, "$1[redacted-path]")
    .replace(RELATIVE_PATH_PATTERN, "$1[redacted-path]");
}

export function sanitizeMdPdfProjectCodexReportTexts(values: readonly string[]): string[] {
  return values.map(sanitizeMdPdfProjectCodexReportText);
}

export function sanitizeMdPdfProjectCodexTerminalText(value: string): string {
  return escapeMdPdfProjectCodexTerminalText(sanitizeMdPdfProjectCodexReportText(value));
}
