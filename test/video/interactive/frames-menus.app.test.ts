import { expect, test } from "bun:test";
import { runFrameMenuFixture } from "./fixtures/frames-menu-fixture";

for (const scenario of [
  "boundaries",
  "resize",
  "cadence",
  "count-information",
  "destination-information",
  "custom-destinations-inline",
  "custom-destinations-simple",
  "naming-information",
  "retained-filename-inline",
  "retained-filename-simple",
  "direct",
  "naming",
  "settings",
])
  test(
    "Node frames menus preserve " + scenario + " and release input ownership",
    async () => {
      expect(await runFrameMenuFixture("frames-menu-navigation.ts", scenario)).toEqual({
        scenario,
        passed: true,
      });
    },
    20_000,
  );
