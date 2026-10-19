import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const heartbeat = fileURLToPath(new URL("./worker-heartbeat", import.meta.url));
let writes = 0;
let next = 0;
// Deliberately block the worker event loop while leaving its supervisor independent.
while (true) {
  if (Date.now() >= next) {
    writeFileSync(heartbeat, String(++writes));
    next = Date.now() + 10;
  }
}
