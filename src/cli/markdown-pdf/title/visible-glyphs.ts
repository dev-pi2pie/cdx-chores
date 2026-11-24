import { createRequire } from "node:module";

import type { PDFOperatorList, PDFPageProxy } from "pdfjs-dist/types/src/display/api";

type Bounds = [number, number, number, number];
type Ops = typeof import("pdfjs-dist/legacy/build/pdf.mjs").OPS;
type Run = { index: number; text: string };

// Only these native canvas operations participate in the proof. PDF.js owns the
// optional package; installations without it can still use the ordinary renderer.
interface Outline {
  transform(matrix: unknown): Outline;
  computeTightBounds(): Bounds;
  op(path: Outline, operation: number): Outline;
  toSVGString(): string;
}

interface DrawingContext {
  globalAlpha: number;
  fillStyle: unknown;
  getTransform(): unknown;
  save(): void;
  restore(): void;
  clip(path: Outline): void;
  fill(path: Outline): void;
  fillText: () => void;
  drawImage: () => void;
  stroke: () => void;
}

interface NativeCanvas {
  Path2D: new (path: Outline) => Outline;
  PathOp: { Intersect: number };
  createCanvas(width: number, height: number): { getContext(type: "2d"): DrawingContext };
}

interface Fill {
  operation: number;
  outline: Outline;
  bounds: Bounds;
  clip: Bounds;
  color: unknown;
  alpha: number;
}

function rectangularPath(data: ArrayLike<number> | undefined): boolean {
  // PDF.js packs moveTo, three lineTo commands and closePath for a rectangle.
  if (
    data?.length !== 13 ||
    data[0] !== 0 ||
    data[3] !== 1 ||
    data[6] !== 1 ||
    data[9] !== 1 ||
    data[12] !== 4
  )
    return false;
  const [, x0, y0, , x1, y1, , x2, y2, , x3, y3] = Array.from(data);
  return (
    [x0, y0, x1, y1, x2, y2, x3, y3].every(Number.isFinite) &&
    x0 !== x2 &&
    y0 !== y2 &&
    ((x0 === x1 && y1 === y2 && x2 === x3 && y3 === y0) ||
      (y0 === y1 && x1 === x2 && y2 === y3 && x3 === x0))
  );
}

function supportsDrawing(operators: PDFOperatorList, ops: Ops): boolean {
  const supported = new Set([
    ops.transform,
    ops.save,
    ops.restore,
    ops.beginMarkedContent,
    ops.setGState,
    ops.setFillRGBColor,
    ops.clip,
    ops.constructPath,
    ops.endMarkedContent,
    ops.beginMarkedContentProps,
    ops.beginText,
    ops.setTextMatrix,
    ops.dependency,
    ops.setFont,
    ops.showText,
    ops.endText,
  ]);
  return operators.fnArray.every((op, i) => {
    const args = operators.argsArray[i];
    if (op === ops.transform) return args[1] === 0 && args[2] === 0;
    if (op === ops.constructPath)
      return (args[0] === ops.endPath || args[0] === ops.fill) && rectangularPath(args[1]?.[0]);
    if (op === ops.setGState)
      return args[0].every(
        ([name, value]: [string, number]) =>
          name === "ca" && Number.isFinite(value) && value >= 0 && value <= 1,
      );
    return supported.has(op);
  });
}

function intersect(a: Bounds, b: Bounds): Bounds {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
}

function hasArea(box: Bounds): boolean {
  return box[0] < box[2] && box[1] < box[3];
}

function fullyInside(box: Bounds, clip: Bounds): boolean {
  return clip[0] < box[0] && clip[1] < box[1] && clip[2] > box[2] && clip[3] > box[3];
}

function uncertain(): never {
  throw new Error("Unsupported PDF paint in title visibility proof");
}

async function collectFills(
  page: PDFPageProxy,
  operators: PDFOperatorList,
  native: NativeCanvas,
  ops: Ops,
) {
  const viewport = page.getViewport({ scale: 1 });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  if (!(width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 4_000_000))
    return [];
  const canvas = native.createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const save = ctx.save.bind(ctx);
  const restore = ctx.restore.bind(ctx);
  let clip: Bounds = [0, 0, viewport.width, viewport.height];
  const clips: Bounds[] = [];
  const fills: Fill[] = [];
  let operation = -1;

  function geometry(path: Outline) {
    if (!(path instanceof native.Path2D)) uncertain();
    const outline = new native.Path2D(path).transform(ctx.getTransform());
    const bounds = outline.computeTightBounds();
    if (!bounds.every(Number.isFinite)) uncertain();
    return { outline, bounds };
  }

  ctx.save = () => {
    clips.push(clip);
    save();
  };
  ctx.restore = () => {
    clip = clips.pop() ?? uncertain();
    restore();
  };
  // Intercept geometry before canvas clipping discards obscured parts of a glyph.
  // PDF.js still sets its normal transforms, colors and font positioning.
  ctx.clip = (path) => {
    if (operators.fnArray[operation] !== ops.constructPath) uncertain();
    clip = intersect(clip, geometry(path).bounds);
  };
  ctx.fill = (path) => {
    if (fills.length >= 4096) uncertain();
    const { outline, bounds } = geometry(path);
    if (hasArea(bounds))
      fills.push({
        operation,
        outline,
        bounds,
        clip,
        color: ctx.fillStyle,
        alpha: ctx.globalAlpha,
      });
  };
  ctx.fillText = ctx.stroke = ctx.drawImage = uncertain;

  type Render = Parameters<PDFPageProxy["render"]>[0];
  await page.render({
    canvas: canvas as unknown as Render["canvas"],
    canvasContext: ctx as unknown as Render["canvasContext"],
    viewport,
    operationsFilter: (index) => {
      operation = index;
      return true;
    },
  }).promise;
  return fills;
}

function expectedOutlines(run: Run, operators: PDFOperatorList, ops: Ops): number | undefined {
  if (operators.fnArray[run.index] !== ops.showText) return;
  const glyphs: unknown = operators.argsArray[run.index]?.[0];
  if (!Array.isArray(glyphs)) return;
  let text = "";
  let count = 0;
  for (const glyph of glyphs) {
    if (typeof glyph === "number" && Number.isFinite(glyph)) continue; // PDF text positioning.
    if (typeof glyph?.unicode !== "string" || !glyph.unicode) return;
    text += glyph.unicode;
    if (/^\s+$/u.test(glyph.unicode)) continue;
    if (glyph.isInFont !== true) return;
    // A single font outline can represent several characters, as in an ffi ligature.
    count++;
  }
  return text === run.text ? count : undefined;
}

function completeTitle(
  fills: Fill[],
  runs: ReadonlyArray<Run>,
  native: NativeCanvas,
  operators: PDFOperatorList,
  ops: Ops,
): boolean {
  const runIndices = new Set(runs.map((run) => run.index));
  const title = fills.filter((fill) => runIndices.has(fill.operation));
  if (
    !title.length ||
    runs.some(
      (run) =>
        title.filter((fill) => fill.operation === run.index).length !==
        expectedOutlines(run, operators, ops),
    )
  )
    return false;

  return title.every((glyph) => {
    if (
      glyph.alpha !== 1 ||
      typeof glyph.color !== "string" ||
      !/^#[0-9a-f]{6}$/iu.test(glyph.color) ||
      glyph.color.toLowerCase() === "#ffffff" ||
      !fullyInside(glyph.bounds, glyph.clip)
    )
      return false;

    return fills.every((other) => {
      if (other === glyph || other.alpha === 0) return true;
      if (other.operation < glyph.operation && other.color === "#ffffff") return true;
      if (!hasArea(intersect(glyph.bounds, intersect(other.bounds, other.clip)))) return true;
      // Kerning and emphasis can bring outline bounds together even when the
      // letters themselves do not touch. Compare the actual filled paths.
      const overlap = new native.Path2D(glyph.outline).op(other.outline, native.PathOp.Intersect);
      return overlap.toSVGString() === "";
    });
  });
}

/** A bounded inspection of an original, tagged WeasyPrint page on white paper. */
export async function hasVisibleGlyphs(
  page: PDFPageProxy,
  operators: PDFOperatorList,
  runs: ReadonlyArray<Run>,
): Promise<boolean> {
  try {
    if (
      !runs.length ||
      runs.reduce((n, run) => n + run.text.length, 0) > 256 ||
      operators.fnArray.length > 16384
    )
      return false;
    const { OPS, AnnotationType } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (!supportsDrawing(operators, OPS)) return false;
    const annotations = await page.getAnnotations({ intent: "any" });
    if (
      annotations.some(
        (a) =>
          a.annotationType !== AnnotationType.LINK ||
          a.hasAppearance !== false ||
          a.borderStyle?.width !== 0 ||
          a.backgroundColor != null,
      )
    )
      return false;
    const load = createRequire(import.meta.url);
    const native = createRequire(load.resolve("pdfjs-dist/package.json"))(
      "@napi-rs/canvas",
    ) as NativeCanvas;
    return completeTitle(
      await collectFills(page, operators, native, OPS),
      runs,
      native,
      operators,
      OPS,
    );
  } catch {
    return false;
  }
}
