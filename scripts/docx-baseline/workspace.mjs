import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Remove only the unique directory allocated by this invocation, including on failure. */
export async function withTemporaryWorkspace(run) {
  const workspace = await mkdtemp(join(tmpdir(), "cdx-docx-baseline-"));
  try {
    return await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
