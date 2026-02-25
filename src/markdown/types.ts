export type FrontmatterType = "yaml" | "toml" | "json";

export interface ParsedMarkdown {
  frontmatter: string | null;
  content: string;
  data: Record<string, unknown> | null;
  frontmatterType: FrontmatterType | null;
}

export type SectionMode =
  | "all"
  | "split"
  | "frontmatter"
  | "content"
  | "per-key"
  | "split-per-key";

// Placeholder shape until/if a dedicated word-count module is reintroduced.
export type SectionWordCountResult = Record<string, unknown>;

export interface SectionedResult {
  section: SectionMode;
  total: number;
  frontmatterType: FrontmatterType | null;
  items: Array<{
    name: string;
    source: "frontmatter" | "content";
    result: SectionWordCountResult;
  }>;
}
