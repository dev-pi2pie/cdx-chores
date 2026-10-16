import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function seedStackedMergedBandFixture(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(
    join(import.meta.dir, "extract", "stacked-merged-band.xlsx"),
    join(outputDir, "stacked-merged-band.xlsx"),
  );
}
