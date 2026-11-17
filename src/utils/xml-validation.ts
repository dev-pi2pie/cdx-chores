import { SyntaxValidator } from "fast-xml-validator";

/** Keep syntax policy shared while callers own diagnostics and recovery. */
export function isValidXml(xml: string): boolean {
  try {
    // fast-xml-validator 1.4.4 treats leading xml-prefixed processing instructions
    // such as <?xml-stylesheet?> as XML declarations.
    // A space after the optional BOM lets validation accept these processing instructions.
    // Parsing still uses the original XML.
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
