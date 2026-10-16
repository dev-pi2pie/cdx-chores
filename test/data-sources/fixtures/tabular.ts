import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const fixtures = [
  "basic.csv",
  "basic.tsv",
  "collapsed-merged.xlsx",
  "generic.csv",
  "header-band.xlsx",
  "messy.xlsx",
  "multi.sqlite",
  "multi.xlsx",
  "no-head.csv",
];

export function seedDataExtractFixtures(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  for (const name of fixtures) {
    copyFileSync(join(import.meta.dir, "extract", name), join(outputDir, name));
  }
}
