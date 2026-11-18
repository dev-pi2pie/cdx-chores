import { expect, test } from "bun:test";

import {
  captureSpeedRequest,
  fixtureModel,
  runSdkProbe,
  speedCases,
} from "./fixtures/speed-provider";

test.each(speedCases)(
  "SDK sends the selected tier: $label",
  async ({ baseline, selection, wireTier }) => {
    const requests = await captureSpeedRequest(baseline, (fixture) =>
      runSdkProbe(fixture, selection),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: fixtureModel });
    expect(requests[0]?.service_tier).toBe(wireTier);
  },
  15_000,
);
