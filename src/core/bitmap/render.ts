/**
 * Browser-only canvas renderer for key bitmaps (OffscreenCanvas when available, HTMLCanvasElement otherwise).
 *
 * Icon font: the self-hosted `material-symbols` package ships ONE variable woff2 per style
 * (family "Material Symbols Rounded", axes wght 100..700, FILL, GRAD, opsz). Canvas cannot set
 * `font-variation-settings`, so only `weight` is honoured (through the CSS font-weight in `ctx.font`);
 * `fill` is approximated by a thin outline stroke. Both are best-effort.
 */
import { MAX_IMAGE_SIDE } from '../constants';
import type { KeyAppearance } from '../types';
import { OLED_H, OLED_W, packPixels } from './pack';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** CSS family name of the icon font (declared in index.css through `material-symbols/rounded.css`). */
export const ICON_FONT_FAMILY = 'Material Symbols Rounded';
const TEXT_FONT_FAMILY = 'Inter, "Segoe UI", Roboto, sans-serif';

function createCtx(w: number, h: number): Ctx2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    if (ctx) return ctx;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  return ctx;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/** Thrown when the icon font is still unavailable; the caller should retry once `whenIconFontReady()` resolves. */
export class FontNotReadyError extends Error {
  constructor() {
    super('Fonte de ícones ainda não carregada.');
    this.name = 'FontNotReadyError';
  }
}

const ICON_FONT_RETRY_MS = 10_000;
const ICON_FONT_WAIT_MS = 15_000;

/** Waits for the icon font to be usable again (retries the load, 10 s budget). */
async function ensureIconFont(font: string, text: string, loaded: FontFace[]): Promise<boolean> {
  if (loaded.length > 0 && document.fonts.check(font, text)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ICON_FONT_RETRY_MS);
  });
  const retry = (async () => {
    await document.fonts.ready;
    const faces = await document.fonts.load(font, text);
    return faces.length > 0 && document.fonts.check(font, text);
  })().catch(() => false);
  try {
    return await Promise.race([retry, budget]);
  } finally {
    clearTimeout(timer);
  }
}

async function loadFonts(a: KeyAppearance): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const needsIcon = a.mode === 'icon' && a.layout !== 'text-only';
  const iconFont = `${a.icon.weight} ${a.icon.size}px "${ICON_FONT_FAMILY}"`;
  const iconLoad = needsIcon ? document.fonts.load(iconFont, a.icon.name).catch(() => [] as FontFace[]) : null;
  // Label font failure is non-fatal: draw with whatever the browser has.
  const labelLoad = a.label.text
    ? document.fonts.load(`${a.label.bold ? 700 : 400} ${a.label.size}px Inter`, a.label.text).catch(() => [] as FontFace[])
    : null;
  const [iconFaces] = await Promise.all([iconLoad, labelLoad]);
  if (needsIcon && !(await ensureIconFont(iconFont, a.icon.name, iconFaces ?? []))) {
    throw new FontNotReadyError();
  }
}

/**
 * Resolves true once the icon font is available (probe: 24px, "home"), false after ~15 s.
 * Listens to `loadingdone` so it reacts as soon as the @font-face finishes loading.
 */
export function whenIconFontReady(): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
  const font = `24px "${ICON_FONT_FAMILY}"`;
  const isReady = () => document.fonts.check(font, 'home');
  if (isReady()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      document.fonts.removeEventListener('loadingdone', onChange);
      resolve(ok);
    };
    const onChange = () => {
      if (isReady()) finish(true);
    };
    timer = setTimeout(() => finish(false), ICON_FONT_WAIT_MS);
    document.fonts.addEventListener('loadingdone', onChange);
    void document.fonts.ready.then(() => {
      if (isReady()) finish(true);
    });
  });
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  let p = imageCache.get(dataUrl);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.src = dataUrl;
    });
    imageCache.set(dataUrl, p);
    if (imageCache.size > 16) {
      const first = imageCache.keys().next().value;
      if (first !== undefined) imageCache.delete(first);
    }
    p.catch(() => imageCache.delete(dataUrl));
  }
  return p;
}

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawText(ctx: Ctx2D, a: KeyAppearance, cx: number, cy: number, align: CanvasTextAlign) {
  const text = a.label.text;
  if (!text) return;
  const size = clamp(a.label.size, 6, 28);
  ctx.font = `${a.label.bold ? 'bold' : 'normal'} ${size}px ${TEXT_FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const lh = size * 1.15;
  const top = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lh));
}

function drawIcon(ctx: Ctx2D, a: KeyAppearance, cx: number, cy: number) {
  const size = clamp(a.icon.size, 8, 56);
  const weight = clamp(Math.round(a.icon.weight / 100) * 100, 100, 700);
  ctx.font = `${weight} ${size}px "${ICON_FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(a.icon.name, cx, cy);
  if (a.icon.fill) {
    ctx.lineWidth = Math.max(0.75, size / 28);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';
    ctx.strokeText(a.icon.name, cx, cy);
  }
}

async function drawImageSource(ctx: Ctx2D, a: KeyAppearance) {
  const src = a.image;
  if (!src) return;
  const img = await loadImage(src.dataUrl);
  const iw = img.naturalWidth || MAX_IMAGE_SIDE;
  const ih = img.naturalHeight || MAX_IMAGE_SIDE;
  let w: number;
  let h: number;
  if (src.fit === 'stretch') {
    w = OLED_W;
    h = OLED_H;
  } else {
    const s = src.fit === 'cover' ? Math.max(OLED_W / iw, OLED_H / ih) : Math.min(OLED_W / iw, OLED_H / ih);
    w = iw * s;
    h = ih * s;
  }
  const zoom = clamp(src.zoom, 0.25, 4);
  w *= zoom;
  h *= zoom;
  const x = OLED_W / 2 + clamp(src.offsetX, -128, 128) - w / 2;
  const y = OLED_H / 2 + clamp(src.offsetY, -64, 64) - h / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, w, h);
}

async function drawAppearance(a: KeyAppearance): Promise<Ctx2D> {
  await loadFonts(a);
  const ctx = createCtx(OLED_W, OLED_H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OLED_W, OLED_H);
  ctx.fillStyle = '#fff';

  if (a.mode === 'image') {
    await drawImageSource(ctx, a);
    ctx.fillStyle = '#fff';
    drawText(ctx, a, 64 + a.label.x, 52 + a.label.y, 'center');
  } else if (a.mode === 'icon') {
    const { x: ix, y: iy } = a.icon;
    const { x: tx, y: ty } = a.label;
    switch (a.layout) {
      case 'icon-text-side':
        drawIcon(ctx, a, 36 + ix, 32 + iy);
        drawText(ctx, a, 68 + tx, 32 + ty, 'left');
        break;
      case 'icon-text-below':
        drawIcon(ctx, a, 64 + ix, 22 + iy);
        drawText(ctx, a, 64 + tx, 48 + ty, 'center');
        break;
      case 'text-only':
        drawText(ctx, a, 64 + tx, 32 + ty, 'center');
        break;
      default:
        drawIcon(ctx, a, 64 + ix, 32 + iy);
    }
  } else {
    drawText(ctx, a, 64 + a.label.x, 32 + a.label.y, 'center');
  }

  if (a.border) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 2, 2, 124, 60, 6);
    ctx.stroke();
  }
  return ctx;
}

/**
 * Renders a key appearance into a 1024-byte bitmap (threshold/invert/dither applied).
 * Awaits font loading first. Browser only.
 */
export async function renderKeyBitmap(a: KeyAppearance): Promise<Uint8Array> {
  const ctx = await drawAppearance(a);
  const data = ctx.getImageData(0, 0, OLED_W, OLED_H);
  return packPixels(data.data, { threshold: a.threshold, invert: a.invert, dither: a.dither });
}

/** Renders the pre-threshold grayscale source (128x64) for the "source" preview. Browser only. */
export async function renderPreviewRGBA(a: KeyAppearance): Promise<ImageData> {
  const ctx = await drawAppearance(a);
  return ctx.getImageData(0, 0, OLED_W, OLED_H);
}

/**
 * Reads an image file (PNG/JPG/SVG/WebP) and returns a data URL downscaled to at most 512px on the
 * longest side (SVG is rasterised at 512px). JPEG stays JPEG; everything else becomes PNG.
 */
export async function loadImageFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Arquivo de imagem inválido ou não suportado.'));
      el.src = url;
    });
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) {
      w = MAX_IMAGE_SIDE;
      h = MAX_IMAGE_SIDE;
    }
    const scale = isSvg ? MAX_IMAGE_SIDE / Math.max(w, h) : Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
    ctx.drawImage(img, 0, 0, tw, th);
    return file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.88) : canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
