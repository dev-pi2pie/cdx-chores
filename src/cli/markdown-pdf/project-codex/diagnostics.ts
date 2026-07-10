import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";

export function collectMdPdfProjectCodexUnsupportedDirections(input: {
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): string[] {
  const templateHandledForwardedDirections =
    input.templatePhase.phase.decisionMode === "adapted"
      ? new Set(input.templatePhase.forwardedProfileDirections)
      : new Set<string>();
  const unmatchedProfileDirections = input.profilePhase.unmatchedProfileDirections.filter(
    (direction) => !templateHandledForwardedDirections.has(direction),
  );

  return Array.from(
    new Set([
      ...unmatchedProfileDirections,
      ...(input.templatePhase.synthesis.unsupportedDirections ?? []),
    ]),
  );
}
