import { CliError } from "../errors";
export const EXPORT_GROUP_LIMIT = 128;
/** Balanced additions avoid the native expression parser's recursion limit. */
export function frameSelect(ordinals: readonly number[]): string {
  if (
    !ordinals.length ||
    ordinals.length > EXPORT_GROUP_LIMIT ||
    ordinals.some(
      (number, index) =>
        !Number.isSafeInteger(number) ||
        number < 1 ||
        (index > 0 && number <= ordinals[index - 1]!),
    )
  )
    throw new CliError("Frame selection requires a bounded increasing ordinal group.", {
      code: "FRAME_GROUP_LIMIT",
    });
  let terms = ordinals.map((ordinal) => `eq(n,${ordinal - 1})`);
  while (terms.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < terms.length; index += 2)
      next.push(
        terms[index + 1] === undefined ? terms[index]! : `(${terms[index]}+${terms[index + 1]})`,
      );
    terms = next;
  }
  return `select='${terms[0]}'`;
}
