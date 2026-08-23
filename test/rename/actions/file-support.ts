import { copyFile, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { removeIfPresent } from "../../helpers/cli-action-test-utils";
import { createTempFixtureDir } from "../../helpers/cli-test-utils";

export const DEFAULT_RENAME_TIME = new Date("2026-02-25T03:04:05.000Z");

type RenameFileFixtureOptions = {
  content?: string;
  sourceFixture?: string;
  time?: Date;
};

export async function createRenameFileFixture(
  fixtureDir: string,
  dirName: string,
  fileName: string,
  options: RenameFileFixtureOptions = {},
) {
  const dirPath = join(fixtureDir, dirName);
  const filePath = join(dirPath, fileName);
  await mkdir(dirPath, { recursive: true });
  if (options.sourceFixture) {
    await copyFile(options.sourceFixture, filePath);
  } else {
    await writeFile(filePath, options.content ?? "fake", "utf8");
  }
  const fixedTime = options.time ?? DEFAULT_RENAME_TIME;
  await utimes(filePath, fixedTime, fixedTime);
  return { dirPath, filePath };
}

export async function withRenameWorkspace(
  run: (fixtureDir: string, trackPlanCsv: (path: string | undefined) => void) => Promise<void>,
) {
  const fixtureDir = await createTempFixtureDir("actions");
  let planCsvPath: string | undefined;
  try {
    await run(fixtureDir, (path) => {
      planCsvPath = path;
    });
  } finally {
    await removeIfPresent(planCsvPath);
    await rm(fixtureDir, { recursive: true, force: true });
  }
}
