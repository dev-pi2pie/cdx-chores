import type { FontFace } from "../../../src/fonts";

export function face(family: string, path = `/private/${family}.otf`): FontFace {
  return { family, fullName: family, path, source: "system", style: "normal" };
}

export function discoveryResult(families: string[]) {
  return {
    adapter: "fontconfig",
    discovery: "fontconfig" as const,
    faces: families.map((family) => face(family)),
    warnings: [],
  };
}

export async function promptTick(): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
