import { SyntaxValidator } from "fast-xml-validator";

/** Keep syntax policy shared while callers own diagnostics and recovery. */
export function isValidXml(xml: string): boolean {
  try {
    return (
      SyntaxValidator.validate(xml, {
        multipleRoots: true,
        // Upstream's option name intentionally uses this spelling.
        xmlDeclaraion: { optional: true, argPosition: false },
        invalidCharSequence: { comment: false, tagValue: false, attrLt: false },
      }) === true
    );
  } catch {
    return false;
  }
}
