import { contractNoteCases } from "./notes.ts";
import { contractStyleMapCases } from "./style-maps.ts";
import { contractSymbolCases } from "./symbols.ts";

/** Contract research is separate from the unchanged Phase 1 semantic/resource baseline. */
export function createContractCases() {
  return [...contractSymbolCases(), ...contractStyleMapCases(), ...contractNoteCases()];
}
