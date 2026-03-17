function isZeroWidthCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x0000 && codePoint <= 0x001f) ||
    (codePoint >= 0x007f && codePoint <= 0x009f) ||
    codePoint === 0x200d ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function isFullWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (
      codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      ((codePoint >= 0x2e80 && codePoint <= 0x3247) && codePoint !== 0x303f) ||
      (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
      (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
      (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
      (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    )
  );
}

function getCodePointWidth(character: string): number {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || isZeroWidthCodePoint(codePoint)) {
    return 0;
  }
  return isFullWidthCodePoint(codePoint) ? 2 : 1;
}

export function getDisplayWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    width += getCodePointWidth(character);
  }
  return width;
}

export function padToDisplayWidth(value: string, width: number): string {
  const padding = Math.max(0, width - getDisplayWidth(value));
  return `${value}${" ".repeat(padding)}`;
}

export function truncateToDisplayWidth(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  let result = "";
  let consumed = 0;
  for (const character of value) {
    const charWidth = getCodePointWidth(character);
    if (consumed + charWidth > width) {
      break;
    }
    result += character;
    consumed += charWidth;
  }
  return result;
}

export function truncateAndPadToDisplayWidth(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  if (getDisplayWidth(value) <= width) {
    return padToDisplayWidth(value, width);
  }
  if (width <= 3) {
    return ".".repeat(width);
  }

  const truncated = truncateToDisplayWidth(value, width - 3);
  return `${padToDisplayWidth(truncated, width - 3)}...`;
}
