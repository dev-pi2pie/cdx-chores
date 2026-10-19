import { SyntaxValidator } from "fast-xml-validator";

/** Keep syntax policy shared while callers own diagnostics and recovery. */
export function isValidXml(xml: string): boolean {
  try {
    // Upstream 1.4.2 mistakes every initial "<?xml" prefix for a declaration.
    // A validation-only space after the optional BOM preserves non-declaration PIs.
    const validationXml = xml.replace(/^(\uFEFF?)<\?xml(?=[^\x20\t\r\n?])/, "$1 <?xml");
    return (
      SyntaxValidator.validate(validationXml, {
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
