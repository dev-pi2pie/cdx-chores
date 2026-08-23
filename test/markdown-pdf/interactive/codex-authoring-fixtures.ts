export const RECIPES_ENTRY = ["md", "md:pdf-recipes"];
export const TO_PDF_ENTRY = ["md", "md:to-pdf"];

export type CodexArtifact = "profile" | "template-bundle" | "project-bundle";

export function recipesCodexSelections(artifact: CodexArtifact): string[] {
  return [
    ...RECIPES_ENTRY,
    artifact,
    ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
    "none",
  ];
}
