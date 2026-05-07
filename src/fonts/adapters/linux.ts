import type { FontDiscoveryAdapter } from "../types";
import { fontconfigFontAdapter } from "./fontconfig";

export const linuxFontAdapter: FontDiscoveryAdapter = {
  name: "linux-fontconfig",
  discover: fontconfigFontAdapter.discover,
};
