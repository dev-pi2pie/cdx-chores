import type { CodexSpeed } from "../../../utils/codex-execution";
import type { CodexAppServer } from "../app-server";

interface CatalogModel {
  id?: string;
  model: string;
  isDefault?: boolean;
  serviceTiers?: Array<{ id: string; name: string }>;
}

async function listModels(
  server: CodexAppServer,
  provider: string | undefined,
  signal?: AbortSignal,
) {
  const models: CatalogModel[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const page = await server.request<{ data: CatalogModel[]; nextCursor: string | null }>(
      "model/list",
      { modelProvider: provider, cursor, includeHidden: true, limit: 100 },
      { signal },
    );
    models.push(...page.data);
    if (page.nextCursor === null) return models;
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) {
      throw new Error("Codex app-server returned a repeated or invalid model cursor.");
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new Error("Codex app-server exceeded its model page limit.");
}

export class BenchmarkCatalog {
  private models?: Promise<CatalogModel[]>;
  private configuredModel?: Promise<string | null>;

  constructor(
    private server: CodexAppServer,
    private cwd: string,
    private provider?: string,
    private signal?: AbortSignal,
  ) {}

  async tierFor(model: string | null, speed: CodexSpeed): Promise<string | undefined> {
    if (speed === "standard") return "default";
    this.models ??= listModels(this.server, this.provider, this.signal);
    const models = await this.models;
    if (!model) {
      this.configuredModel ??= this.server
        .request<{ config: { model?: string | null } }>(
          "config/read",
          { cwd: this.cwd, includeLayers: false },
          { signal: this.signal },
        )
        .then(({ config }) => config.model ?? null);
      model =
        (await this.configuredModel) ?? models.find((entry) => entry.isDefault)?.model ?? null;
    }
    const selected = models.find((entry) => entry.model === model || entry.id === model);
    const knownTier = speed === "fast" ? "priority" : "ultrafast";
    return selected?.serviceTiers?.find(
      (tier) => tier.id === knownTier || tier.name?.toLowerCase() === speed,
    )?.id;
  }
}

export function isTierRejection(message: string): boolean {
  if (
    /\bdoes not support (?:the )?(?:(?:priority|standard|fast|ultrafast) )?service[ _-]?tier\b/i.test(
      message,
    )
  ) {
    return true;
  }
  return (
    /\b(?:service[ _-]?tier|ultrafast|fast mode|priority tier)\b/i.test(message) &&
    /\b(?:unsupported|supported|unavailable|available|allowed|requires|invalid|unknown|unrecognized|eligible)\b/i.test(
      message,
    )
  );
}
