import { runCli } from "./command";

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to run CLI:", message);
  process.exitCode = 1;
});
