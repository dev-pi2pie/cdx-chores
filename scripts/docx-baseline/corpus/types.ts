export interface DocxBaselineCase {
  id: string;
  category: string;
  variations: string[];
  input: { fixture: string } | { bytes: Buffer };
  expected: {
    rawIncludes?: string[];
    rawExcludes?: string[];
    rawOrdered?: string[];
    htmlIncludes?: string[];
    htmlExcludes?: string[];
    rawEquals?: string;
    htmlEquals?: string;
    reason?: string;
    titleFirst?: string;
    warningsInclude?: string[];
    metadataTitle?: string;
    headings?: string[];
  };
}
