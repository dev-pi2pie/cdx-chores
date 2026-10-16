export interface DocxBaselineCase {
  id: string;
  category: string;
  variations: string[];
  /** Potentially pathological research inputs run only through the bounded Node launcher. */
  execution?: "bounded-node";
  input: { fixture: string } | { bytes: Buffer };
  expected: {
    rawIncludes?: string[];
    rawExcludes?: string[];
    rawOrdered?: string[];
    htmlIncludes?: string[];
    htmlExcludes?: string[];
    htmlOccurrences?: Record<string, number>;
    rawEquals?: string;
    htmlEquals?: string;
    htmlMessagesInclude?: string[];
    rawMessagesInclude?: string[];
    htmlErrorIncludes?: string;
    rawErrorIncludes?: string;
    reason?: string;
    titleFirst?: string;
    titleCandidates?: string[];
    warningsInclude?: string[];
    metadataTitle?: string;
    headings?: string[];
  };
}
