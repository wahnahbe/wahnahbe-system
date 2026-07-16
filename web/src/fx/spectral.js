import gsap from 'gsap';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FILTER_ID = 'fx-spectral';
const NOTE_LINE_SELECTOR = '[data-fx-note-line]';
const RADAR_SELECTOR = '[data-fx-radar]';
const RADAR_ATTR = 'points';
const SCALE_FROM = 14;
const SCALE_TO = 0;
const DURATION = 0.45;
const EASE = 'power3.out';

let active = false;
let svgDef = null;
let displacementEl = null;
let bodyObserver = null;
let radarObserver = null;
let tween = null;
let busy = false;
let glowEl = null;

/** @param {string} tag @returns {Element} */
function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

/** Builds the shared `<svg><filter id="fx-spectral">…</filter></svg>` def. */
function buildFilterDef() {
  const svg = svgEl('svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute' });

  const filter = svgEl('filter');
  filter.setAttribute('id', FILTER_ID);

  const turbulence = svgEl('feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.02 0.4');
  turbulence.setAttribute('numOctaves', '1');
  turbulence.setAttribute('result', 'n');
  turbulence.setAttribute('seed', '2');

  const displacement = svgEl('feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'n');
  displacement.setAttribute('scale', '0');

  filter.appendChild(turbulence);
  filter.appendChild(displacement);
  svg.appendChild(filter);
  return { svg, displacement };
}

/**
 * Applies the shared displacement filter to `el` and tweens it out. A
 * module-level `busy` flag makes an overlapping trigger (a notification
 * appearing mid-radar-tween, or vice versa) a no-op for the later one,
 * since one shared `<filter>` can't animate two independent displacements
 * at once — v1 accepts skipping the overlap rather than queuing it.
 * @param {Element} el
 */
function trigger(el) {
  if (busy || !el || !displacementEl) return;
  busy = true;
  glowEl = el;
  el.style.filter = `url(#${FILTER_ID})`;
  tween = gsap.fromTo(displacementEl,
    { attr: { scale: SCALE_FROM } },
    {
      attr: { scale: SCALE_TO },
      duration: DURATION,
      ease: EASE,
      onComplete: () => {
        el.style.filter = '';
        glowEl = null;
        tween = null;
        busy = false;
      },
    });
}

/**
 * Spectral displacement flicker: a shared SVG `feDisplacementMap` filter,
 * tweened from a heavy 14px scale down to 0 (settling), triggered whenever a
 * notification line is inserted or the radar's data polygon redraws (its
 * `points` attribute changes). Injects one `width=0 height=0` SVG def at
 * mount; nothing renders it directly — elements opt in via `style.filter`
 * only for the trigger's duration.
 *
 * Mirrors decode.js's `document.body` subtree observer for notification
 * lines, since `Notification.jsx` renders `[data-fx-notes]` conditionally —
 * the container and its lines are fresh DOM nodes each time a notification
 * appears, so only observing the body catches every occurrence regardless
 * of mount timing.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;

  const { svg, displacement } = buildFilterDef();
  document.body.appendChild(svg);
  svgDef = svg;
  displacementEl = displacement;
  active = true;

  const bodyRoot = root.body ?? root;
  bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const lines = node.matches?.(NOTE_LINE_SELECTOR)
          ? [node]
          : Array.from(node.querySelectorAll?.(NOTE_LINE_SELECTOR) ?? []);
        lines.forEach((line) => trigger(line));
      }
    }
  });
  bodyObserver.observe(bodyRoot, { childList: true, subtree: true });

  const radarEl = root.querySelector(RADAR_SELECTOR);
  if (radarEl) {
    radarObserver = new MutationObserver(() => trigger(radarEl));
    radarObserver.observe(radarEl, { attributes: true, attributeFilter: [RADAR_ATTR] });
  }
}

export function unmount() {
  if (!active) return;
  bodyObserver?.disconnect();
  bodyObserver = null;
  radarObserver?.disconnect();
  radarObserver = null;
  tween?.kill();
  tween = null;
  if (glowEl) {
    glowEl.style.filter = '';
    glowEl = null;
  }
  svgDef?.remove();
  svgDef = null;
  displacementEl = null;
  busy = false;
  active = false;
}
