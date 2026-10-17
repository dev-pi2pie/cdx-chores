import { contractNoteCases } from "./notes.ts";
import { contractStyleMapCases } from "./style-maps.ts";
import { contractSymbolCases } from "./symbols.ts";

/** Additional symbol, style-map, and note compatibility cases. */
export function createContractCases() {
  return [...contractSymbolCases(), ...contractStyleMapCases(), ...contractNoteCases()];
}
