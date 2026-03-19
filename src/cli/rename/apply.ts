import { rename } from "node:fs/promises";

import type { PlannedRename } from "../types";

export async function applyPlannedRenames(plans: PlannedRename[]): Promise<void> {
  const changes = plans.filter((plan) => plan.changed);
  if (changes.length === 0) {
    return;
  }

  const tempMoves: Array<{ tempPath: string; finalPath: string }> = [];

  let index = 0;
  for (const plan of changes) {
    const tempPath = `${plan.fromPath}.cdx-chores-tmp-${process.pid}-${index}`;
    await rename(plan.fromPath, tempPath);
    tempMoves.push({ tempPath, finalPath: plan.toPath });
    index += 1;
  }

  for (const move of tempMoves) {
    await rename(move.tempPath, move.finalPath);
  }
}
