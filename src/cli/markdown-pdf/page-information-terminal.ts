/** Display-only escaping; saved Profile and Codex request text remain exact. */
export function escapeMarkdownPdfPageInformationTerminalText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (character) => {
    const hex = character.codePointAt(0)!.toString(16);
    return hex.length > 4 ? `\\u{${hex}}` : `\\u${hex.padStart(4, "0")}`;
  });
}
