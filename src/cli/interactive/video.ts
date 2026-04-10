import { confirm, input, select } from "@inquirer/prompts";

import { actionVideoConvert, actionVideoGif, actionVideoResize } from "../actions";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../prompts/path";
import type { CliRuntime } from "../types";
import type { VideoGifMode, VideoGifProfile } from "../video-gif";
import type { VideoInteractiveActionKey } from "./menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

export async function handleVideoInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: VideoInteractiveActionKey,
): Promise<void> {
  if (action === "video:convert") {
    const inputPath = await promptRequiredPathWithConfig("Input video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputPath = await promptRequiredPathWithConfig("Output video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoConvert(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "video:resize") {
    const inputPath = await promptRequiredPathWithConfig("Input video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputPath = await promptRequiredPathWithConfig("Output video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const scale = Number(
      await input({
        message: "Scale factor (for example 0.5 halves size, 2 doubles it)",
        validate: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return "Required";
          }
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) && parsed > 0 ? true : "Enter a positive number.";
        },
      }),
    );
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoResize(runtime, {
      input: inputPath,
      output: outputPath,
      scale,
      overwrite,
    });
    return;
  }

  if (action !== "video:gif") {
    assertNeverInteractiveAction(action);
  }

  const inputPath = await promptRequiredPathWithConfig("Input video file", {
    kind: "file",
    ...pathPromptContext,
  });
  const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".gif");
  const outputPath = await promptOptionalOutputPathChoice({
    message: "Output GIF file",
    defaultHint: outputHint,
    kind: "file",
    ...pathPromptContext,
    customMessage: "Custom GIF output path",
  });
  const mode = await select<VideoGifMode>({
    message: "GIF mode",
    choices: [
      {
        name: "compressed",
        value: "compressed",
        description: "One-pass conversion with the current default behavior",
      },
      {
        name: "quality",
        value: "quality",
        description: "Two-pass palette workflow for better color fidelity",
      },
    ],
  });
  const gifProfile =
    mode === "quality"
      ? await select<VideoGifProfile>({
          message: "GIF profile",
          choices: [
            {
              name: "video",
              value: "video",
              description: "Balanced default for most clips",
            },
            {
              name: "motion",
              value: "motion",
              description: "Better for fast movement and rapid scene changes",
            },
            {
              name: "screen",
              value: "screen",
              description: "Better for UI, text, and screen recordings",
            },
          ],
        })
      : undefined;
  const widthInput = await input({ message: "Width in px (optional)", default: "480" });
  const fpsInput = await input({ message: "FPS (optional)", default: "10" });
  const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
  await actionVideoGif(runtime, {
    input: inputPath,
    output: outputPath,
    mode,
    gifProfile,
    width: widthInput.trim() ? Number(widthInput) : undefined,
    fps: fpsInput.trim() ? Number(fpsInput) : undefined,
    overwrite,
  });
}
