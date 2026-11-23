import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";
import { installMarkdownPdfCodexAuthoringMock } from "./mocks/codex-authoring";
import { installMarkdownPdfDeterministicAuthoringMock } from "./mocks/deterministic-authoring";
import { installMarkdownPdfFontDiscoveryMock } from "./mocks/font-discovery";
import { installMarkdownPdfRenderingMocks } from "./mocks/rendering";
import { installMarkdownPdfSessionMock } from "./mocks/session";

export function installMarkdownPdfMocks(context: HarnessRunnerContext): void {
  installMarkdownPdfFontDiscoveryMock(context);
  installMarkdownPdfSessionMock(context);
  installMarkdownPdfCodexAuthoringMock(context);
  installMarkdownPdfDeterministicAuthoringMock(context);
  installMarkdownPdfRenderingMocks(context);
}
