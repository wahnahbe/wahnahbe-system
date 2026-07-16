const GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  '0123456789';
const COLUMN_WIDTH = 14;
const TRAIL_FILL = 'rgba(10,7,20,0.08)';
const GLYPH_FILL = 'rgba(63,232,255,0.85)';
const CANVAS_OPACITY = '0.05';
const RESET_PAST_BOTTOM_CHANCE = 0.975;

let active = false;
let canvas = null;
let canvasCtx = null;
let drops = []; // one row-position per column
let rafId = null;
let onResize = null;
let onVisibility = null;

/** Rebuilds the column array for the current canvas size. */
function rebuildColumns() {
  const count = Math.max(0, Math.floor(canvas.width / COLUMN_WIDTH));
  drops = Array.from({ length: count }, () => Math.random() * (canvas.height / COLUMN_WIDTH));
}

/** Resizes the canvas to the viewport and rebuilds columns to match. */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  rebuildColumns();
}

/** Single rAF frame: fade the previous frame, draw one glyph per column. */
function draw() {
  canvasCtx.fillStyle = TRAIL_FILL;
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  canvasCtx.fillStyle = GLYPH_FILL;
  canvasCtx.font = `${COLUMN_WIDTH}px monospace`;
  for (let i = 0; i < drops.length; i += 1) {
    const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const x = i * COLUMN_WIDTH;
    const y = drops[i] * COLUMN_WIDTH;
    canvasCtx.fillText(glyph, x, y);
    if (y > canvas.height && Math.random() > RESET_PAST_BOTTOM_CHANCE) {
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
 * Full-viewport katakana/digit rain on a fixed canvas, inserted as the first
 * child of `<body>` so it sits behind every panel (panels have opaque-ish
 * backgrounds and paint above it in normal flow) while still living above the
 * page background. Rendered at low opacity as ambient texture. Pauses its
 * rAF loop while the tab is hidden and rebuilds columns on resize. Silent
 * no-op if a 2D canvas context isn't available (e.g. jsdom in tests).
 * @param {{ root: Document }} _ctx
 */
export function mount(_ctx) {
  if (active) return;

  canvas = document.createElement('canvas');
  canvas.setAttribute('data-fx-rain', '1');
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    zIndex: '0', pointerEvents: 'none', opacity: CANVAS_OPACITY,
  });
  document.body.insertBefore(canvas, document.body.firstChild);

  canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    canvas.remove();
    canvas = null;
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
  drops = [];
  active = false;
}
