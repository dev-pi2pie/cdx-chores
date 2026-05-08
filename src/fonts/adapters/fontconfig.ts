import { extname } from "node:path";

import type { FontDiscoveryAdapter, FontFace, FontFormat, FontStyle } from "../types";

const FONTCONFIG_LIST_FORMAT = "%{family}\t%{fullname}\t%{style}\t%{file}\t%{index}\n";

interface FontconfigListRow {
  rawFamily: string;
  rawFullName: string | undefined;
  rawStyle: string | undefined;
  rawPath: string | undefined;
  rawFaceIndex: string | undefined;
}

function fontFormatFromPath(path: string | undefined): FontFormat {
  const extension = extname(path ?? "").toLowerCase();
  if (extension === ".ttf") {
    return "ttf";
  }
  if (extension === ".otf") {
    return "otf";
  }
  if (extension === ".ttc") {
    return "ttc";
  }
  if (extension === ".woff") {
    return "woff";
  }
  if (extension === ".woff2") {
    return "woff2";
  }
  return "unknown";
}

function fontStyleFromText(value: string): FontStyle {
  const normalized = value.toLowerCase();
  if (normalized.includes("oblique")) {
    return "oblique";
  }
  if (normalized.includes("italic")) {
    return "italic";
  }
  return "normal";
}

function fontWeightFromText(value: string): number | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("thin")) {
    return 100;
  }
  if (normalized.includes("extralight") || normalized.includes("ultralight")) {
    return 200;
  }
  if (normalized.includes("light")) {
    return 300;
  }
  if (normalized.includes("medium")) {
    return 500;
  }
  if (normalized.includes("semibold") || normalized.includes("demibold")) {
    return 600;
  }
  if (normalized.includes("bold")) {
    return 700;
  }
  if (normalized.includes("black") || normalized.includes("heavy")) {
    return 900;
  }
  return undefined;
}

function firstFontFamily(value: string): string {
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  );
}

function fontFaceIndexFromText(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }
  const index = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

function parseFontconfigListRow(line: string): FontconfigListRow {
  const [rawFamily = "", rawFullName, rawStyle, rawPath, rawFaceIndex] = line.split("\t");
  return {
    rawFamily,
    rawFullName,
    rawStyle,
    rawPath,
    rawFaceIndex,
  };
}

export function parseFontconfigList(stdout: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const row = parseFontconfigListRow(line);
    const family = firstFontFamily(row.rawFamily);
    if (!family) {
      continue;
    }
    const styleText = row.rawStyle?.trim() ?? "";
    const path = row.rawPath?.trim() || undefined;
    const faceIndex = fontFaceIndexFromText(row.rawFaceIndex);
    faces.push({
      family,
      fullName: row.rawFullName?.trim() || family,
      style: fontStyleFromText(styleText),
      weight: fontWeightFromText(styleText),
      path,
      format: fontFormatFromPath(path),
      ...(faceIndex !== undefined ? { faceIndex } : {}),
      source: "system",
    });
  }
  return faces;
}

export const fontconfigFontAdapter: FontDiscoveryAdapter = {
  name: "fontconfig",
  async discover({ runner }) {
    const result = await runner("fc-list", ["--format", FONTCONFIG_LIST_FORMAT]);
    if (!result.ok) {
      return {
        faces: [],
        warnings: ["fontconfig discovery failed."],
      };
    }
    return {
      faces: parseFontconfigList(result.stdout),
      warnings: [],
    };
  },
};
