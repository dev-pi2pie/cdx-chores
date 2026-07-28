import {
  assessCommandMinimumVersion,
  type CommandStatus,
  type CommandVersionRequirement,
} from "../deps";

export const MARKDOWN_PDF_MINIMUM_PANDOC_VERSION = "2.0";

export interface MarkdownPdfRequirements {
  ready: boolean;
  requirements: {
    pandoc: CommandVersionRequirement;
    weasyprint: {
      status: "satisfied" | "missing";
      available: boolean;
      version: string | null;
    };
  };
}

export function assessMarkdownPdfRequirements(
  pandoc: CommandStatus,
  weasyprint: CommandStatus,
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

  return {
    ready: pandocRequirement.status === "satisfied" && weasyprintRequirement.status === "satisfied",
    requirements: {
      pandoc: pandocRequirement,
      weasyprint: weasyprintRequirement,
    },
  };
}
