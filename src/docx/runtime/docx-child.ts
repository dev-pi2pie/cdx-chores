import { runDocxChild } from "./child";

void runDocxChild().catch(() => {
  process.exitCode = 1;
  process.stdin.destroy();
  process.stdout.end();
});
