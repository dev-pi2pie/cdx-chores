import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
  MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
  MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
} from "../../../cli/markdown-pdf/template-codex";

const TEMPLATE_FAMILY_VALUES = [...MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES, "none"];
const RECIPE_PRESET_VALUES = [...MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS, "none"];

const COVER_LAYOUT_VALUES = ["none", "contained-media", "full-bleed-media"] as const;
const COVER_TITLE_PLACEMENT_VALUES = ["document-title", "below-media"] as const;
const COVER_STYLE_VALUES = ["none", "media"] as const;
const ORIENTATION_BUCKET_VALUES = [
  "landscape",
  "portrait",
  "square",
  "panoramic",
  "tall",
  "unknown",
] as const;
const FIT_PRESSURE_VALUES = ["normal", "crop-risk", "letterbox-risk", "unknown"] as const;

export const MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    decision_mode: {
      type: "string",
      enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES],
    },
    template_family: {
      type: "string",
      enum: TEMPLATE_FAMILY_VALUES,
    },
    recipe_preset: {
      type: "string",
      enum: RECIPE_PRESET_VALUES,
    },
    slots: {
      type: "object",
      properties: {
        recipe_preset: {
          type: "object",
          properties: {
            preset: { type: "string", enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS] },
            source: {
              type: "string",
              enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES],
            },
          },
          required: ["preset", "source"],
          additionalProperties: false,
        },
        cover: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            image_fit: { type: "string", enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS, ""] },
            layout: { type: "string", enum: COVER_LAYOUT_VALUES },
            title_placement: { type: "string", enum: COVER_TITLE_PLACEMENT_VALUES },
            style: { type: "string", enum: COVER_STYLE_VALUES },
            orientation_bucket: { type: "string", enum: ORIENTATION_BUCKET_VALUES },
            fit_pressure: { type: "string", enum: FIT_PRESSURE_VALUES },
          },
          required: [
            "enabled",
            "image_fit",
            "layout",
            "title_placement",
            "style",
            "orientation_bucket",
            "fit_pressure",
          ],
          additionalProperties: false,
        },
        tables: {
          type: "object",
          properties: {
            density: { type: "string", enum: ["compact", "standard", "wide"] },
            repeat_header: { type: "boolean" },
            width: { type: "string", enum: ["content", "full"] },
          },
          required: ["density", "repeat_header", "width"],
          additionalProperties: false,
        },
        code: {
          type: "object",
          properties: {
            style: { type: "string", enum: ["shiki-compatible"] },
            line_wrap: { type: "string", enum: ["wrap"] },
            preserve_selectors: { type: "boolean" },
          },
          required: ["style", "line_wrap", "preserve_selectors"],
          additionalProperties: false,
        },
        spacing: {
          type: "object",
          properties: {
            density: { type: "string", enum: ["compact", "standard", "spacious"] },
          },
          required: ["density"],
          additionalProperties: false,
        },
        typography: {
          type: "object",
          properties: {
            scale: { type: "string", enum: ["compact", "standard", "reader"] },
          },
          required: ["scale"],
          additionalProperties: false,
        },
        colors: {
          type: "object",
          properties: {
            palette: { type: "string", enum: ["neutral"] },
          },
          required: ["palette"],
          additionalProperties: false,
        },
      },
      required: ["recipe_preset", "cover", "tables", "code", "spacing", "typography", "colors"],
      additionalProperties: false,
    },
    css_blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "string", enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS] },
          css: { type: "string" },
        },
        required: ["slot", "css"],
        additionalProperties: false,
      },
    },
    font_decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES] },
          key: { type: "string" },
          family: { type: "string" },
          source: {
            type: "string",
            enum: [...MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES],
          },
          template_level: { type: "boolean" },
        },
        required: ["role", "key", "family", "source", "template_level"],
        additionalProperties: false,
      },
    },
    managed_assets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_label: { type: "string" },
          bundle_path: { type: "string" },
        },
        required: ["source_label", "bundle_path"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    unsupported_directions: { type: "array", items: { type: "string" } },
    fallback_reason: { type: "string" },
  },
  required: [
    "decision_mode",
    "template_family",
    "recipe_preset",
    "slots",
    "css_blocks",
    "font_decisions",
    "managed_assets",
    "warnings",
    "unsupported_directions",
    "fallback_reason",
  ],
  additionalProperties: false,
} as const;
