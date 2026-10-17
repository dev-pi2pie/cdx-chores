import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { runDocxChild } from "../../../../src/docx/runtime/child";

writeFileSync(fileURLToPath(new URL("./child-pid", import.meta.url)), String(process.pid));
await runDocxChild();
