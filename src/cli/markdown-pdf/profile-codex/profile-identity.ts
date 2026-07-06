import type {
  NormalizedMarkdownPdfProfileIdentity,
  MarkdownPdfProfileSource,
} from "../profile/types";
import type { MarkdownPdfPreset } from "../validation";

export interface MarkdownPdfCodexProfileIdentityInput {
  basedOn: string;
  createdAt: string;
  profileId: string;
  preset?: MarkdownPdfPreset;
  source: MarkdownPdfProfileSource;
}

export function createMarkdownPdfCodexProfileIdentity(
  input: MarkdownPdfCodexProfileIdentityInput,
): NormalizedMarkdownPdfProfileIdentity {
  return {
    id: input.profileId,
    source: input.source,
    basedOn: input.basedOn,
    preset: input.preset,
    createdAt: input.createdAt,
  };
}
