import type { DoctorReport } from "../report";
import { addAction, addCondition, type MutableProjection } from "./kernel";
import type { DoctorWorkflowId } from "./model";

function addMissingPandoc(projection: MutableProjection, report: DoctorReport): void {
  const affectedWorkflowIds: DoctorWorkflowId[] = ["markdown.docx", "markdown.pdf"];
  addCondition(
    projection,
    {
      id: "dependency.pandoc.missing",
      message: "Pandoc is missing",
      affectedWorkflowIds,
    },
    "unavailable",
  );
  addAction(projection, {
    id: "dependency.pandoc.install",
    class: "required",
    message: "Install Pandoc",
    command: report.tools.pandoc.installHint,
    affectedWorkflowIds,
  });
}

export function projectMarkdown(projection: MutableProjection, report: DoctorReport): void {
  const pandoc = report.markdownPdf.requirements.pandoc;
  if (pandoc.status === "missing") {
    addMissingPandoc(projection, report);
  } else if (pandoc.status === "unsupported") {
    addCondition(
      projection,
      {
        id: "dependency.pandoc.unsupported",
        message: "Pandoc does not meet the required 2.0 minimum",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "dependency.pandoc.upgrade",
      class: "required",
      message: "Upgrade Pandoc to 2.0 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
  } else if (pandoc.status === "unverified") {
    addCondition(
      projection,
      {
        id: "dependency.pandoc.unverified",
        message: "Pandoc 2.0 or newer could not be verified",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unknown",
    );
    addAction(projection, {
      id: "dependency.pandoc.verify",
      class: "recommended",
      message: "Verify Pandoc 2.0 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
  }

  if (report.markdownPdf.requirements.weasyprint.status === "missing") {
    addCondition(
      projection,
      {
        id: "dependency.weasyprint.missing",
        message: "WeasyPrint is missing",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "dependency.weasyprint.install",
      class: "required",
      message: "Install WeasyPrint",
      command: report.tools.weasyprint.installHint,
      affectedWorkflowIds: ["markdown.pdf"],
    });
  }

  const baseRequirementsReady =
    pandoc.status === "satisfied" &&
    report.markdownPdf.requirements.weasyprint.status === "satisfied";
  if (!baseRequirementsReady) {
    return;
  }

  const rendererStatuses = new Set(
    report.markdownPdf.rendererCapabilities.capabilities.map((capability) => capability.status),
  );
  rendererStatuses.delete("satisfied");
  if (rendererStatuses.size === 0) {
    return;
  }

  const unsupported = rendererStatuses.has("unsupported") || rendererStatuses.has("missing");
  if (unsupported) {
    addCondition(
      projection,
      {
        id: "markdown.pdf.renderer.capability.unsupported",
        message: "Advanced Markdown PDF features require WeasyPrint 65.1 or newer",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "limited",
    );
    addAction(projection, {
      id: "dependency.weasyprint.upgrade",
      class: "recommended",
      message: "Upgrade WeasyPrint to 65.1 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
    return;
  }

  addCondition(
    projection,
    {
      id: "markdown.pdf.renderer.capability.unverified",
      message: "Advanced Markdown PDF compatibility could not be verified",
      affectedWorkflowIds: ["markdown.pdf"],
    },
    "limited",
  );
  addAction(projection, {
    id: "dependency.weasyprint.verify",
    class: "recommended",
    message: "Verify WeasyPrint 65.1 or newer",
    affectedWorkflowIds: ["markdown.pdf"],
  });
}
