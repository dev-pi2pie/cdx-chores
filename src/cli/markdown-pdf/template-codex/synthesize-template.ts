import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFamily,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

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

  return `<section class="pdf-cover pdf-cover--${input.slots.cover.style}" data-cover-layout="${input.slots.cover.layout}" data-title-placement="${input.slots.cover.titlePlacement}" data-image-fit="${input.slots.cover.imageFit}" data-orientation="${input.slots.cover.orientationBucket}" data-fit-pressure="${input.slots.cover.fitPressure}">
  <figure class="pdf-cover-media">
    <img class="pdf-cover-media__image" src="${coverAsset.bundlePath}" alt="$if(title)$$title$ cover image$else$Cover image$endif$">
    <figcaption class="pdf-cover-media__caption">
$if(title)$
      <span class="pdf-cover-media__title">$title$</span>
$endif$
$if(subtitle)$
      <span class="pdf-cover-media__subtitle">$subtitle$</span>
$endif$
    </figcaption>
  </figure>
</section>
`;
}

export function synthesizeMdPdfTemplateCodexHtml(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
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
${coverMediaHtml({ managedAssets: input.managedAssets, slots: input.slots })}$if(title)$
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
$if(toc)$
<nav id="TOC" role="doc-toc">
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
