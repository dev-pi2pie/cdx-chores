import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { createDocxProductFixture } from "../fixtures/docx-product/build";

let product: Awaited<ReturnType<typeof createDocxProductFixture>>;
beforeAll(async () => {
  product = await createDocxProductFixture();
});
afterAll(async () => {
  await product?.cleanup();
});

for (const mode of ["sequential", "batch", "thread", "concurrent", "input-limits"]) {
  test(`compiled DOCX product preserves ${mode} behavior`, async () => {
    const inputs = join(product.root, mode);
    await mkdir(inputs);
    expect(await product.run(mode, inputs)).toEqual({ passed: true });
  }, 20_000);
}
