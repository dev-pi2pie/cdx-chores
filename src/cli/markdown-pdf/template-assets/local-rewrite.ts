import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse, serialize, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../../errors";
import {
  CSS_IMPORT_PATTERN,
  CSS_URL_FUNCTION_PATTERN,
  getReferenceScheme,
  isHtmlAssetTag,
  isLocalAbsoluteHtmlAssetReference,
  isRelativeHtmlAssetReference,
  realFilePath,
  relativePathStaysInside,
  splitAssetReference,
  splitSrcsetCandidates,
} from "./reference";

const PANDOC_TEMPLATE_VARIABLE_PATTERN = /\$[^$]+\$/u;
const HTML_TEMPLATE_LOCAL_ASSET_ATTRS = new Set(["src", "href", "poster", "data", "xlink:href"]);

async function resolveTemplateLocalHtmlAssetReference(
  value: string,
  templateDirectory: string,
): Promise<string> {
  if (PANDOC_TEMPLATE_VARIABLE_PATTERN.test(value)) {
    throw new CliError(`Template asset path must not contain Pandoc template variables: ${value}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const scheme = getReferenceScheme(value.trim());
  if (scheme === "file") {
    const { path } = splitAssetReference(value);
    const resolvedPath = fileURLToPath(path);
    const resolvedTemplateDirectory = resolve(templateDirectory);
    if (!relativePathStaysInside(resolvedTemplateDirectory, resolvedPath)) {
      throw new CliError(
        `Template asset path must stay inside the custom template directory: ${value}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    const realResolvedPath = await realFilePath(resolvedPath);
    if (!realResolvedPath) {
      throw new CliError(`Template asset path does not exist: ${value}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 1,
      });
    }
    if (!relativePathStaysInside(resolvedTemplateDirectory, realResolvedPath)) {
      throw new CliError(
        `Template asset path must stay inside the custom template directory: ${value}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    return value;
  }
  if (!isRelativeHtmlAssetReference(value)) {
    if (isLocalAbsoluteHtmlAssetReference(value)) {
      throw new CliError(`Template asset path must be relative to the custom template: ${value}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return value;
  }
  const { path, suffix } = splitAssetReference(value);
  const resolvedPath = resolve(templateDirectory, path);
  const resolvedTemplateDirectory = resolve(templateDirectory);
  if (!relativePathStaysInside(resolvedTemplateDirectory, resolvedPath)) {
    throw new CliError(
      `Template asset path must stay inside the custom template directory: ${value}`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const realResolvedPath = await realFilePath(resolvedPath);
  if (!realResolvedPath) {
    throw new CliError(`Template asset path does not exist: ${value}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }
  const realTemplateDirectory = await realpath(resolvedTemplateDirectory);
  if (!relativePathStaysInside(realTemplateDirectory, realResolvedPath)) {
    throw new CliError(
      `Template asset path must stay inside the custom template directory: ${value}`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return `${pathToFileURL(realResolvedPath).href}${suffix}`;
}

async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (match: RegExpMatchArray) => Promise<string>,
): Promise<string> {
  let rewritten = "";
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    rewritten += value.slice(lastIndex, index);
    rewritten += await replacer(match);
    lastIndex = index + match[0].length;
  }
  rewritten += value.slice(lastIndex);
  return rewritten;
}

async function rewriteTemplateLocalCssAssets(
  css: string,
  templateDirectory: string,
): Promise<string> {
  const withUrlFunctions = await replaceAsync(css, CSS_URL_FUNCTION_PATTERN, async (match) => {
    const assetReference = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const rewritten = await resolveTemplateLocalHtmlAssetReference(
      assetReference,
      templateDirectory,
    );
    return `url("${rewritten}")`;
  });
  return await replaceAsync(withUrlFunctions, CSS_IMPORT_PATTERN, async (match) => {
    const assetReference = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    const rewritten = await resolveTemplateLocalHtmlAssetReference(
      assetReference,
      templateDirectory,
    );
    return match[1] ? `@import url("${rewritten}")` : `@import "${rewritten}"`;
  });
}

async function rewriteTemplateLocalSrcset(
  value: string,
  templateDirectory: string,
): Promise<string> {
  const candidates = splitSrcsetCandidates(value);
  const rewrittenCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return candidate;
      }
      const descriptorStart = trimmed.search(/\s/u);
      const assetReference = descriptorStart < 0 ? trimmed : trimmed.slice(0, descriptorStart);
      const descriptor = descriptorStart < 0 ? "" : trimmed.slice(descriptorStart).trim();
      const rewritten = await resolveTemplateLocalHtmlAssetReference(
        assetReference,
        templateDirectory,
      );
      return descriptor ? `${rewritten} ${descriptor}` : rewritten;
    }),
  );
  return rewrittenCandidates.join(", ");
}

export async function rewriteMarkdownPdfTemplateLocalAssets(
  html: string,
  templateDirectory: string,
): Promise<string> {
  const document = parse(html);
  const visit = async (
    node: DefaultTreeAdapterTypes.Node,
    parentTagName?: string,
  ): Promise<void> => {
    if (parentTagName === "style" && "value" in node && typeof node.value === "string") {
      node.value = await rewriteTemplateLocalCssAssets(node.value, templateDirectory);
    }
    const tagName =
      "tagName" in node && typeof node.tagName === "string" ? node.tagName.toLowerCase() : "";
    if ("attrs" in node && Array.isArray(node.attrs)) {
      for (const attr of node.attrs) {
        const attrName = attr.name.toLowerCase();
        if (attrName === "style") {
          attr.value = await rewriteTemplateLocalCssAssets(attr.value, templateDirectory);
          continue;
        }
        if (!isHtmlAssetTag(tagName)) {
          continue;
        }
        if (attrName === "srcset") {
          attr.value = await rewriteTemplateLocalSrcset(attr.value, templateDirectory);
          continue;
        }
        if (!HTML_TEMPLATE_LOCAL_ASSET_ATTRS.has(attrName)) {
          continue;
        }
        attr.value = await resolveTemplateLocalHtmlAssetReference(attr.value, templateDirectory);
      }
    }
    if ("childNodes" in node && Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        await visit(child, tagName);
      }
    }
  };
  await visit(document);
  return serialize(document);
}
