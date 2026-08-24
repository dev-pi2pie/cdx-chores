import { actionDoctor } from "../actions";
import { resolvePathPromptRuntimeConfig } from "../prompts/path-config";
import type { CliRuntime } from "../types";
import { handleDataInteractiveAction } from "./data";
import { selectInteractiveDoctorOutput } from "./doctor";
import { handleMarkdownInteractiveAction } from "./markdown";
import { selectInteractiveAction } from "./menu";
import { handleRenameInteractiveAction } from "./rename";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";
import { createInteractiveSession, type InteractiveSessionOptions } from "./session";
import { handleVideoInteractiveAction } from "./video";

interface RunInteractiveModeImpls {
  selectInteractiveActionImpl?: typeof selectInteractiveAction;
  selectInteractiveDoctorOutputImpl?: typeof selectInteractiveDoctorOutput;
  actionDoctorImpl?: typeof actionDoctor;
}

export async function runInteractiveMode(
  runtime: CliRuntime,
  impls: RunInteractiveModeImpls = {},
  sessionOptions: InteractiveSessionOptions = {},
): Promise<void> {
  const session = createInteractiveSession(sessionOptions);
  const pathPromptContext: InteractivePathPromptContext = {
    runtimeConfig: resolvePathPromptRuntimeConfig(),
    cwd: runtime.cwd,
    stdin: runtime.stdin,
    stdout: runtime.stdout,
  };
  const selectInteractiveActionImpl = impls.selectInteractiveActionImpl ?? selectInteractiveAction;
  const selectInteractiveDoctorOutputImpl =
    impls.selectInteractiveDoctorOutputImpl ?? selectInteractiveDoctorOutput;
  const actionDoctorImpl = impls.actionDoctorImpl ?? actionDoctor;
  let initialGroup: "md" | undefined;
  while (true) {
    const action = await selectInteractiveActionImpl({
      stdin: runtime.stdin,
      stdout: runtime.stdout,
      initialGroup,
    });
    initialGroup = undefined;

    if (action === "cancel") {
      runtime.stdout.write("\nCancelled.\n");
      return;
    }

    if (action === "doctor") {
      const output = await selectInteractiveDoctorOutputImpl({
        input: runtime.stdin,
        output: runtime.stdout,
      });
      await actionDoctorImpl(runtime, {
        details: output === "details",
        json: output === "json",
      });
      return;
    }

    switch (action) {
      case "data:preview":
      case "data:convert":
      case "data:extract":
      case "data:stack":
      case "data:query":
      case "data:parquet-preview":
      case "data:json-to-csv":
      case "data:json-to-tsv":
      case "data:csv-to-json":
      case "data:csv-to-tsv":
      case "data:tsv-to-csv":
      case "data:tsv-to-json":
        await handleDataInteractiveAction(runtime, pathPromptContext, action, session);
        return;
      case "md:to-pdf":
      case "md:pdf-recipes":
      case "md:to-docx":
      case "md:frontmatter-to-json":
        {
          const outcome = await handleMarkdownInteractiveAction(
            runtime,
            pathPromptContext,
            action,
            session,
          );
          if (outcome.kind === "open-submenu") {
            initialGroup = outcome.group;
            continue;
          }
        }
        return;
      case "rename:file":
      case "rename:batch":
      case "rename:cleanup":
      case "rename:apply":
        await handleRenameInteractiveAction(runtime, pathPromptContext, action, session);
        return;
      case "video:convert":
      case "video:resize":
      case "video:gif":
        await handleVideoInteractiveAction(runtime, pathPromptContext, action);
        return;
    }

    assertNeverInteractiveAction(action);
  }
}
