import {
  assessCommandMinimumVersion,
  type CommandStatus,
  type CommandVersionRequirement,
  type DependencyCommandRunner,
} from "../deps";
import { execCommand } from "../process";

export const MARKDOWN_PDF_MINIMUM_PANDOC_VERSION = "2.0";
// WeasyPrint 70.0 is the minimum for protocol restrictions in user stylesheets.
// This version and later versions must advertise --allowed-protocols.
export const MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION = "70.0";
export const MARKDOWN_PDF_PROTOCOL_ALLOWLIST_OPTION = "--allowed-protocols";

export interface MarkdownPdfRequirements {
  ready: boolean;
  readyWithRemoteAssets: boolean;
  requirements: {
    pandoc: CommandVersionRequirement;
    weasyprint: {
      status: "satisfied" | "missing";
      available: boolean;
      version: string | null;
    };
    restrictedAssets: CommandVersionRequirement;
  };
}

export async function inspectMarkdownPdfProtocolAllowlist(
  runner: DependencyCommandRunner = execCommand,
  cwd?: string,
): Promise<boolean> {
  try {
    const help = await runner("weasyprint", ["--help"], { cwd });
    return (
      help.ok &&
      /(?:^|\s)--allowed-protocols(?=\s|=|$)/u.test([help.stdout, help.stderr].join("\n"))
    );
  } catch {
    return false;
  }
}

export function assessMarkdownPdfRequirements(
  pandoc: CommandStatus,
  weasyprint: CommandStatus,
  protocolAllowlist = false,
): MarkdownPdfRequirements {
  const pandocRequirement = assessCommandMinimumVersion(
    pandoc,
    MARKDOWN_PDF_MINIMUM_PANDOC_VERSION,
  );
  const weasyprintRequirement = {
    status: weasyprint.available ? ("satisfied" as const) : ("missing" as const),
    available: weasyprint.available,
    version: weasyprint.version,
  };
  const rendererVersion = assessCommandMinimumVersion(
    weasyprint,
    MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION,
  );
  const restrictedAssets: CommandVersionRequirement = {
    ...rendererVersion,
    status:
      rendererVersion.status === "satisfied" && !protocolAllowlist
        ? "unverified"
        : rendererVersion.status,
  };

  return {
    ready: pandocRequirement.status === "satisfied" && restrictedAssets.status === "satisfied",
    readyWithRemoteAssets: pandocRequirement.status === "satisfied" && weasyprint.available,
    requirements: {
      pandoc: pandocRequirement,
      weasyprint: weasyprintRequirement,
      restrictedAssets,
    },
  };
}
