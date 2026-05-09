import { describe, expect, test } from "bun:test";

import * as folderFacade from "../src/cli/interactive/data-query/index";
import * as legacyFacade from "../src/cli/interactive/data-query";

describe("interactive data-query legacy facade", () => {
  test("re-exports the public folder facade symbols", () => {
    expect(legacyFacade.collectInteractiveIntrospection).toBe(
      folderFacade.collectInteractiveIntrospection,
    );
    expect(legacyFacade.promptDelimitedHeaderMode).toBe(folderFacade.promptDelimitedHeaderMode);
    expect(legacyFacade.promptInteractiveInputFormat).toBe(
      folderFacade.promptInteractiveInputFormat,
    );
    expect(legacyFacade.promptOptionalSourceSelection).toBe(
      folderFacade.promptOptionalSourceSelection,
    );
    expect(legacyFacade.reviewInteractiveHeaderMappings).toBe(
      folderFacade.reviewInteractiveHeaderMappings,
    );
    expect(legacyFacade.runInteractiveDataQuery).toBe(folderFacade.runInteractiveDataQuery);
  });
});
