import type { CliRuntime } from "../../types";
import { commitPreparedMarkdownPdfProfileCodex } from "./commit";
import { bindMarkdownPdfProfileCodexDestination } from "./destination";
import { prepareMarkdownPdfProfileCodex } from "./prepare";
import type { MdPdfProfileCodexOptions } from "./types";

export async function actionMdPdfProfileCodex(
  runtime: CliRuntime,
  options: MdPdfProfileCodexOptions,
): Promise<void> {
  const prepared = await prepareMarkdownPdfProfileCodex(runtime, options);
  const destination = await bindMarkdownPdfProfileCodexDestination(runtime, prepared);
  await commitPreparedMarkdownPdfProfileCodex({ destination, prepared, runtime });
}
