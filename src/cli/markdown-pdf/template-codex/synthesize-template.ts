import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexTitlePolicyDecision,
  MdPdfTemplateCodexSignalCollection,
} from "./types";
import { MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT } from "./families";

function identityComment(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
}): string {
  return `<!-- cdx-chores md pdf-template codex | bundle=${input.outputPlan.bundleId} | family=${input.family} | signal_mode=${input.signals.signalMode} | recipe_preset=${input.slots.recipePreset.preset} | recipe_source=${input.slots.recipePreset.source} -->`;
}

function coverMediaHtml(input: {
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  slots: MarkdownPdfTemplateCodexResolvedSlots;
}): string {
  const coverAsset = input.managedAssets.find((asset) => asset.role === "cover-image");
  if (!input.slots.cover.enabled || !coverAsset) {
    return "";
  }
  const titleHtml = `$if(title)$
      <span class="pdf-cover-media__title">$title$</span>
$endif$`;
  const subtitleHtml = `$if(subtitle)$
      <span class="pdf-cover-media__subtitle">$subtitle$</span>
$endif$`;
  const captionHtml = `    <figcaption class="pdf-cover-media__caption">
${titleHtml}
${subtitleHtml}
    </figcaption>
`;
  const titleCaptionHtml = `$if(title)$
    <figcaption class="pdf-cover-media__caption pdf-cover-media__caption--title">
      <span class="pdf-cover-media__title">$title$</span>
    </figcaption>
$endif$
`;
  const subtitleCaptionHtml = `$if(subtitle)$
    <figcaption class="pdf-cover-media__caption pdf-cover-media__caption--subtitle">
      <span class="pdf-cover-media__subtitle">$subtitle$</span>
    </figcaption>
$endif$
`;
  const imageHtml = `    <img class="pdf-cover-media__image" src="${coverAsset.bundlePath}" alt="$if(title)$$title$ cover image$else$Cover image$endif$">
`;
  const contentHtml = (() => {
    switch (input.slots.cover.composition) {
      case "title-media-subtitle":
        return `${titleCaptionHtml}${imageHtml}${subtitleCaptionHtml}`;
      case "title-subtitle-media":
        return `${captionHtml}${imageHtml}`;
      case "media-background-overlay":
      case "media-first-caption":
        return `${imageHtml}${captionHtml}`;
    }
  })();

  return `<section class="pdf-cover pdf-cover--${input.slots.cover.style}" data-cover-composition="${input.slots.cover.composition}" data-cover-text-align="${input.slots.cover.textAlign}" data-media-align="${input.slots.cover.mediaAlign}" data-media-scale="${input.slots.cover.mediaScale}" data-image-anchor="${input.slots.cover.imageAnchor}" data-image-fit="${input.slots.cover.imageFit}" data-orientation="${input.slots.cover.orientationBucket}" data-fit-pressure="${input.slots.cover.fitPressure}">
  <figure class="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.coverMediaClass}">
${contentHtml}  </figure>
</section>
`;
}

function documentTitleHtml(titlePolicy: MarkdownPdfTemplateCodexTitlePolicyDecision): string {
  if (!titlePolicy.visibleMetadataTitle) {
    return "";
  }
  return `$if(title)$
<header class="document-title">
  <h1 class="title">$title$</h1>
$if(author)$
  <p class="author">$for(author)$$author$$sep$, $endfor$</p>
$endif$
$if(date)$
  <p class="date">$date$</p>
$endif$
</header>
$endif$
`;
}

export function synthesizeMdPdfTemplateCodexHtml(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
  titlePolicy: MarkdownPdfTemplateCodexTitlePolicyDecision;
}): string {
  return `<!doctype html>
${identityComment(input)}
<html lang="$if(lang)$$lang$$else$en$endif$">
<head>
  <meta charset="utf-8">
  <meta name="generator" content="cdx-chores md pdf-template codex">
  <title>$if(title)$$title$$else$Markdown PDF$endif$</title>
</head>
<body class="template-family-${input.family}">
${coverMediaHtml({ managedAssets: input.managedAssets, slots: input.slots })}${documentTitleHtml(input.titlePolicy)}
$if(toc)$
<nav id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}" role="doc-toc">
$toc$
</nav>
$endif$
<main class="document-body">
$body$
</main>
</body>
</html>
`;
}
