import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PAGE_NUMBER_BODY_HOOK_CASES } from "./body-hooks";
import { WEASYPRINT_CANDIDATES } from "./candidates";
import {
  PAGE_NUMBER_AUTOMATED_EVIDENCE,
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
} from "./constants";
import { PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS } from "./product-scenarios";
import { PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS } from "./project-scenarios";
import { PAGE_NUMBER_RENDERER_SCENARIOS } from "./renderer-scenarios";
import type { MaterializedRendererContract } from "./types";

const fixtureDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const launchMarkdownName = "page-number-launch.md";
const launchProfileName = "page-number-launch-profile.yml";

function stableCatalogPayload(launchMarkdown: string, launchProfile: string) {
  return JSON.stringify({
    candidates: WEASYPRINT_CANDIDATES,
    scenarios: PAGE_NUMBER_RENDERER_SCENARIOS,
    productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
    projectScenarios: PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
    evidenceBoundary: {
      automated: PAGE_NUMBER_AUTOMATED_EVIDENCE,
      visualReviewRequired: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => ({
        scenarioId: scenario.id,
        assertions: scenario.visualReviewRequired,
      })).concat(
        PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map((scenario) => ({
          scenarioId: scenario.id,
          assertions: scenario.visualReviewRequired,
        })),
      ),
    },
    bodyHookCases: PAGE_NUMBER_BODY_HOOK_CASES,
    launch: { markdown: launchMarkdown, profile: launchProfile },
  });
}

export async function readPageNumberLaunchFixtures(): Promise<{
  markdown: string;
  profile: string;
}> {
  const [markdown, profile] = await Promise.all([
    readFile(join(fixtureDirectory, launchMarkdownName), "utf8"),
    readFile(join(fixtureDirectory, launchProfileName), "utf8"),
  ]);
  return { markdown, profile };
}

export async function pageNumberRendererContractDigest(): Promise<string> {
  const launch = await readPageNumberLaunchFixtures();
  return createHash("sha256")
    .update(stableCatalogPayload(launch.markdown, launch.profile))
    .digest("hex");
}

export async function materializePageNumberRendererContract(
  labRoot: string,
): Promise<MaterializedRendererContract> {
  const marker = await readFile(join(labRoot, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
  if (marker !== PAGE_NUMBER_LAB_MARKER_CONTENT) {
    throw new Error("Refusing to materialize renderer fixtures in an unowned laboratory.");
  }

  const launch = await readPageNumberLaunchFixtures();
  const catalogDigest = createHash("sha256")
    .update(stableCatalogPayload(launch.markdown, launch.profile))
    .digest("hex");
  const fixtureRoot = join(labRoot, "fixtures");
  const scenarioDirectories: Record<string, string> = {};
  const bodyHookPaths: Record<string, string> = {};
  const productLaunches: Record<
    string,
    {
      markdownPath: string;
      profilePath: string;
      templatePath?: string;
      cssPath?: string;
    }
  > = {};
  const projectLaunches: Record<
    string,
    {
      authoringDirectory: string;
      baseProfilePath?: string;
      coverImagePath?: string;
      markdownPath: string;
      projectDirectory: string;
      bundlePath: string;
      profilePath: string;
      templatePath: string;
      cssPath: string;
    }
  > = {};

  await mkdir(fixtureRoot);
  for (const scenario of PAGE_NUMBER_RENDERER_SCENARIOS) {
    const scenarioDirectory = join(fixtureRoot, scenario.id);
    await mkdir(scenarioDirectory);
    await Promise.all([
      writeFile(join(scenarioDirectory, "input.html"), scenario.html, "utf8"),
      writeFile(join(scenarioDirectory, "style.css"), scenario.css, "utf8"),
    ]);
    scenarioDirectories[scenario.id] = scenarioDirectory;
  }

  const bodyHookDirectory = join(fixtureRoot, "body-hooks");
  await mkdir(bodyHookDirectory);
  for (const bodyHookCase of PAGE_NUMBER_BODY_HOOK_CASES) {
    const bodyHookPath = join(bodyHookDirectory, `${bodyHookCase.id}.html`);
    await writeFile(bodyHookPath, bodyHookCase.html, "utf8");
    bodyHookPaths[bodyHookCase.id] = bodyHookPath;
  }

  const launchDirectory = join(fixtureRoot, "actual-launch");
  await mkdir(launchDirectory);
  const markdownPath = join(launchDirectory, launchMarkdownName);
  const profilePath = join(launchDirectory, launchProfileName);
  await Promise.all([
    writeFile(markdownPath, launch.markdown, "utf8"),
    writeFile(profilePath, launch.profile, "utf8"),
    writeFile(
      join(fixtureRoot, "contract.json"),
      `${JSON.stringify(
        {
          catalogDigest,
          candidates: WEASYPRINT_CANDIDATES,
          scenarios: PAGE_NUMBER_RENDERER_SCENARIOS.map(
            ({ html: _html, css: _css, ...scenario }) => scenario,
          ),
          productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map(
            ({
              markdown: _markdown,
              profile: _profile,
              template: _template,
              css: _css,
              ...scenario
            }) => scenario,
          ),
          projectScenarios: PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map(
            ({ authoring, markdown: _markdown, ...scenario }) => ({
              ...scenario,
              authoring:
                authoring.mode === "base-profile-only"
                  ? { ...authoring, baseProfile: undefined }
                  : {
                      ...authoring,
                      coverImage: { ...authoring.coverImage, base64: undefined },
                    },
            }),
          ),
          evidenceBoundary: {
            automated: PAGE_NUMBER_AUTOMATED_EVIDENCE,
            visualReviewRequired: [
              ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
              ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
            ].map((scenario) => ({
              scenarioId: scenario.id,
              assertions: scenario.visualReviewRequired,
            })),
          },
          bodyHookCases: PAGE_NUMBER_BODY_HOOK_CASES.map(
            ({ html: _html, ...bodyHookCase }) => bodyHookCase,
          ),
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  const productLaunchDirectory = join(fixtureRoot, "product-launches");
  await mkdir(productLaunchDirectory);
  for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS) {
    const scenarioDirectory = join(productLaunchDirectory, scenario.id);
    await mkdir(scenarioDirectory);
    const markdownPath = join(scenarioDirectory, "input.md");
    const profilePath = join(scenarioDirectory, "profile.yml");
    const templatePath = scenario.template ? join(scenarioDirectory, "template.html") : undefined;
    const cssPath = scenario.css ? join(scenarioDirectory, "custom.css") : undefined;
    await Promise.all([
      writeFile(markdownPath, scenario.markdown, "utf8"),
      writeFile(profilePath, scenario.profile, "utf8"),
      ...(templatePath && scenario.template
        ? [writeFile(templatePath, scenario.template, "utf8")]
        : []),
      ...(cssPath && scenario.css ? [writeFile(cssPath, scenario.css, "utf8")] : []),
    ]);
    productLaunches[scenario.id] = {
      markdownPath,
      profilePath,
      ...(templatePath ? { templatePath } : {}),
      ...(cssPath ? { cssPath } : {}),
    };
  }

  const projectLaunchDirectory = join(fixtureRoot, "project-launches");
  await mkdir(projectLaunchDirectory);
  for (const scenario of PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS) {
    const authoringDirectory = join(projectLaunchDirectory, scenario.id);
    await mkdir(authoringDirectory);
    const markdownPath = join(authoringDirectory, "input.md");
    const projectDirectory = join(authoringDirectory, "project");
    const baseProfilePath =
      scenario.authoring.mode === "base-profile-only"
        ? join(authoringDirectory, "base-profile.yml")
        : undefined;
    const coverImagePath =
      scenario.authoring.mode === "cover-image-only"
        ? join(authoringDirectory, scenario.authoring.coverImage.fileName)
        : undefined;
    await Promise.all([
      writeFile(markdownPath, scenario.markdown, "utf8"),
      ...(baseProfilePath && scenario.authoring.mode === "base-profile-only"
        ? [writeFile(baseProfilePath, scenario.authoring.baseProfile, "utf8")]
        : []),
      ...(coverImagePath && scenario.authoring.mode === "cover-image-only"
        ? [writeFile(coverImagePath, Buffer.from(scenario.authoring.coverImage.base64, "base64"))]
        : []),
    ]);
    projectLaunches[scenario.id] = {
      authoringDirectory,
      ...(baseProfilePath ? { baseProfilePath } : {}),
      ...(coverImagePath ? { coverImagePath } : {}),
      markdownPath,
      projectDirectory,
      bundlePath: projectDirectory,
      profilePath: join(projectDirectory, "profile.yml"),
      templatePath: join(projectDirectory, "template.html"),
      cssPath: join(projectDirectory, "style.css"),
    };
  }

  return {
    catalogDigest,
    fixtureRoot,
    bodyHookPaths,
    scenarioDirectories,
    launch: { markdownPath, profilePath },
    productLaunches,
    projectLaunches,
  };
}
