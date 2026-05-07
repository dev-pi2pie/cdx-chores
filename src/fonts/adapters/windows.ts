import { join } from "node:path";

import type { FontDiscoveryAdapter, FontFace, FontFormat, FontStyle } from "../types";

interface WindowsRegistryFont {
  name?: string;
  value?: string;
}

function fontFormatFromValue(value: string | undefined): FontFormat {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.endsWith(".ttf")) {
    return "ttf";
  }
  if (normalized.endsWith(".otf")) {
    return "otf";
  }
  if (normalized.endsWith(".ttc")) {
    return "ttc";
  }
  if (normalized.endsWith(".woff")) {
    return "woff";
  }
  if (normalized.endsWith(".woff2")) {
    return "woff2";
  }
  return "unknown";
}

function fontStyleFromName(name: string): FontStyle {
  const normalized = name.toLowerCase();
  if (normalized.includes("oblique")) {
    return "oblique";
  }
  if (normalized.includes("italic")) {
    return "italic";
  }
  return "normal";
}

function stripRegistrySuffix(name: string): string {
  return name.replace(/\s*\((?:TrueType|OpenType)\)\s*$/i, "").trim();
}

function resolveWindowsFontPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return value;
  }
  return join("C:\\Windows\\Fonts", value);
}

export function parseWindowsFontRegistry(stdout: string): FontFace[] {
  const parsed = JSON.parse(stdout) as WindowsRegistryFont | WindowsRegistryFont[] | null;
  const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return entries
    .map((entry) => {
      const fullName = stripRegistrySuffix(entry.name ?? "");
      if (!fullName) {
        return null;
      }
      const path = resolveWindowsFontPath(entry.value);
      return {
        family: fullName,
        fullName,
        style: fontStyleFromName(fullName),
        path,
        format: fontFormatFromValue(entry.value),
        source: "system",
      } satisfies FontFace;
    })
    .filter((font): font is FontFace => font !== null);
}

export const windowsFontAdapter: FontDiscoveryAdapter = {
  name: "windows-registry",
  async discover({ runner }) {
    const script = [
      "$fonts = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';",
      "$fonts.PSObject.Properties |",
      "Where-Object { $_.Name -notlike 'PS*' } |",
      "ForEach-Object { [PSCustomObject]@{ name = $_.Name; value = $_.Value } } |",
      "ConvertTo-Json -Compress",
    ].join(" ");
    const result = await runner("powershell.exe", ["-NoProfile", "-Command", script]);
    if (!result.ok) {
      return {
        faces: [],
        warnings: ["Windows font discovery failed."],
      };
    }
    try {
      return {
        faces: parseWindowsFontRegistry(result.stdout),
        warnings: [],
      };
    } catch (error) {
      return {
        faces: [],
        warnings: [error instanceof Error ? error.message : "Failed to parse Windows fonts."],
      };
    }
  },
};
