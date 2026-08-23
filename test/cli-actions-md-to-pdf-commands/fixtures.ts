import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function minimalPng(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

async function createCodexJsonlStub(input: {
  fixtureDir: string;
  filename: string;
  response: string;
}): Promise<string> {
  const stubPath = join(input.fixtureDir, input.filename);
  await writeFile(
    stubPath,
    `#!/usr/bin/env node
await new Promise((resolve, reject) => {
  process.stdin.resume();
  process.stdin.on("end", resolve);
  process.stdin.on("error", reject);
});
const response = ${JSON.stringify(input.response)};
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-thread" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.started" }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { id: "msg-1", type: "agent_message", text: response },
}) + "\\n");
process.stdout.write(JSON.stringify({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
}) + "\\n");
`,
    "utf8",
  );
  await chmod(stubPath, 0o755);
  return stubPath;
}

export async function createTemplateCodexStub(fixtureDir: string): Promise<string> {
  return await createCodexJsonlStub({
    fixtureDir,
    filename: "template-codex-stub.mjs",
    response: JSON.stringify({
      decision_mode: "no-usable-template",
      template_family: "none",
      recipe_preset: "none",
      slots: {
        recipe_preset: { preset: "article", source: "renderer-default" },
        cover: {
          enabled: false,
          byline: "none",
          composition: "media-first-caption",
          image_fit: "",
          image_anchor: "center",
          media_align: "center",
          media_scale: "balanced",
          text_align: "center",
          style: "none",
          orientation_bucket: "unknown",
          fit_pressure: "unknown",
        },
        tables: { density: "standard", repeat_header: true, width: "content" },
        code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
        spacing: { density: "standard" },
        typography: { scale: "standard" },
        colors: { palette: "neutral" },
      },
      css_blocks: [],
      font_decisions: [],
      managed_assets: [],
      warnings: ["Unsupported template direction."],
      unsupported_directions: ["Unsupported template direction."],
      fallback_reason: "Unsupported template direction.",
    }),
  });
}

export async function createProfileCodexStub(fixtureDir: string): Promise<string> {
  return await createCodexJsonlStub({
    fixtureDir,
    filename: "profile-codex-stub.mjs",
    response: JSON.stringify({
      decision_mode: "no-usable-profile",
      selected_candidate_id: "none",
      accepted_patches: [],
      accepted_font_patches: [],
      reasoning: "The requested profile direction is unsupported.",
      warnings: ["Unsupported profile direction."],
      fallback_reason: "Unsupported profile direction.",
      unmatched_directions: ["unsupported profile direction"],
    }),
  });
}

export async function createFakeMarkdownPdfDependencies(
  binDir: string,
  html: string,
): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const escapedHtml = html.replaceAll("\\", "\\\\").replaceAll("'", "'\\''");
  const pandocPath = join(binDir, "pandoc");
  const weasyprintPath = join(binDir, "weasyprint");

  await writeFile(
    pandocPath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then echo "pandoc 3.1"; exit 0; fi',
      'out=""',
      'while [ "$#" -gt 0 ]; do',
      '  if [ "$1" = "--output" ]; then shift; out="$1"; fi',
      "  shift",
      "done",
      `printf '%s' '${escapedHtml}' > "$out"`,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    weasyprintPath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--info" ]; then echo "WeasyPrint 68.0"; exit 0; fi',
      'out=""',
      'for arg in "$@"; do out="$arg"; done',
      'printf "%s\\n" "%PDF-1.7" > "$out"',
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(pandocPath, 0o755);
  await chmod(weasyprintPath, 0o755);
}
