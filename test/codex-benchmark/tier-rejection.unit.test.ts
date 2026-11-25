import { expect, test } from "bun:test";

import { isTierRejection } from "../../src/adapters/codex/benchmark/catalog";

test.each([
  ["Service tier priority is not supported for this account.", true],
  ["This account does not support the priority service tier.", true],
  ["This account is not eligible for the priority service tier.", true],
  ["Service tier 'priority' is not eligible for this account.", true],
  ['Unsupported parameter: "service_tier" is not supported with this model.', true],
  ['Unsupported parameter: "image_url" is not supported with this service tier.', false],
  ["Invalid value for 'service_tier': priority.", true],
  ["Image input is not eligible for this model at the priority service tier.", false],
  ["This model does not support image input at the priority service tier.", false],
  ["Image input is not supported by this model at the priority service tier.", false],
] as const)("classifies provider wording %j as a tier rejection: %s", (message, rejected) => {
  expect(isTierRejection(message)).toBe(rejected);
});
