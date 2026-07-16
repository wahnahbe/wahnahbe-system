const GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  '0123456789';
const FX_ROOT_SELECTOR = '[data-fx-root]';
const COLUMN_WIDTH = 14;
const TRAIL_FILL = 'rgba(10,7,20,0.08)';
const GLYPH_FILL = 'rgba(63,232,255,0.85)';
const CANVAS_OPACITY = '0.05';
const RESET_PAST_BOTTOM_CHANCE = 0.975;
const MAX_DPR = 2;

let active = false;
let canvas = null;
let canvasCtx = null;
let fxRoot = null;
let width = 0; // logical (CSS) canvas size — draw() and column math stay in
let height = 0; // this space; the physical canvas.width/height carry the DPR scale-up
let drops = []; // one row-position per column
let rafId = null;
let onResize = null;
let onVisibility = null;

/** Rebuilds the column array for the current canvas size. */
function rebuildColumns() {
  const count = Math.max(0, Math.floor(width / COLUMN_WIDTH));
  drops = Array.from({ length: count }, () => Math.random() * (height / COLUMN_WIDTH));
}

/**
 * Resizes the canvas to its container and rebuilds columns to match. Backs
 * the canvas with `devicePixelRatio` physical pixels (capped at MAX_DPR so
 * an extreme DPR can't blow up the backing store) while keeping every draw
 * call in logical CSS-pixel space via `ctx.scale`.
 */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  width = fxRoot.clientWidth;
  height = fxRoot.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
  canvasCtx.scale(dpr, dpr);
  rebuildColumns();
}

/** Single rAF frame: fade the previous frame, draw one glyph per column. */
function draw() {
  canvasCtx.fillStyle = TRAIL_FILL;
  canvasCtx.fillRect(0, 0, width, height);

  canvasCtx.fillStyle = GLYPH_FILL;
  canvasCtx.font = `${COLUMN_WIDTH}px monospace`;
  for (let i = 0; i < drops.length; i += 1) {
    const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const x = i * COLUMN_WIDTH;
    const y = drops[i] * COLUMN_WIDTH;
    canvasCtx.fillText(glyph, x, y);
    if (y > height && Math.random() > RESET_PAST_BOTTOM_CHANCE) {
      drops[i] = 0;
    } else {
      drops[i] += 1;
    }
  }
  rafId = requestAnimationFrame(draw);
}

function pauseLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function resumeLoop() {
  if (active && rafId == null && document.visibilityState !== 'hidden') {
    rafId = requestAnimationFrame(draw);
  }
}

/**
 * Katakana/digit rain on a canvas confined to the `[data-fx-root]` panel
 * grid. Rendered at low opacity as ambient texture behind the panels.
 * Pauses its rAF loop while the tab is hidden and rebuilds columns on
 * resize. Silent no-op if `[data-fx-root]` isn't present, or if a 2D canvas
 * context isn't available (e.g. jsdom in tests).
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  fxRoot = root.querySelector(FX_ROOT_SELECTOR);
  if (!fxRoot) return;

  canvas = document.createElement('canvas');
  canvas.setAttribute('data-fx-rain', '1');
  Object.assign(canvas.style, {
    position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
    zIndex: '0', pointerEvents: 'none', opacity: CANVAS_OPACITY,
  });
  // invariant: must be the first child of [data-fx-root] — panels are later
  // siblings in normal flow and paint over this canvas by source order, and
  // the container must establish the positioning context (position:relative,
  // set on the element itself — see App.jsx) for this absolute canvas to
  // fill it instead of the nearest other positioned ancestor.
  fxRoot.insertBefore(canvas, fxRoot.firstChild);

  canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    canvas.remove();
    canvas = null;
    fxRoot = null;
    return;
  }

  active = true;
  resizeCanvas();
  rafId = requestAnimationFrame(draw);

  onResize = () => resizeCanvas();
  window.addEventListener('resize', onResize);

  onVisibility = () => {
    if (document.hidden) pauseLoop();
    else resumeLoop();
  };
  document.addEventListener('visibilitychange', onVisibility);
}

export function unmount() {
  if (!active) return;
  pauseLoop();
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
  onResize = null;
  onVisibility = null;
  canvas?.remove();
  canvas = null;
  canvasCtx = null;
  fxRoot = null;
  width = 0;
  height = 0;
  drops = [];
  active = false;
}
