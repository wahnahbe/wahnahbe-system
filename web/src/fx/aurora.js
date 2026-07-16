import { Renderer, Program, Mesh, Triangle } from 'ogl';

const FX_ROOT_SELECTOR = '[data-fx-root]';
// Half-resolution backing store on purpose — a soft ambient layer doesn't
// need full-res detail, and OGL's `dpr` accepts values below 1 (it's a
// plain multiplier used by Renderer.setSize, not clamped to the display's
// devicePixelRatio).
const AURORA_DPR = 0.5;

const VERTEX = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;
  uniform float uTime; uniform float uIntensity; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<3;i++){ v+=a*noise(p); p*=2.1; a*=.5; } return v; }
  void main(){
    vec2 uv = vUv * 1.6; float t = uTime * 0.02;
    float n1 = fbm(uv + t), n2 = fbm(uv * 1.7 - t * 1.3), n3 = fbm(uv * 0.7 + t * 0.6);
    vec3 col = vec3(0.28,0.09,0.44)*smoothstep(.35,.85,n1)
             + vec3(0.10,0.35,0.42)*smoothstep(.45,.9,n2)
             + vec3(0.55,0.42,0.16)*smoothstep(.6,.95,n3)*0.6;
    gl_FragColor = vec4(col * uIntensity, 0.35);
  }
`;

let active = false;
let fxRoot = null;
let canvas = null;
let renderer = null;
let program = null;
let mesh = null;
let rafId = null;
let onResize = null;
let onVisibility = null;
let elapsed = 0; // seconds of uTime accumulated so far
let lastFrameTime = null; // rAF timestamp from the previous frame, or null to skip delta on first frame

/** Resizes the renderer (and its canvas) to fill `[data-fx-root]`. */
function resize() {
  if (!renderer || !fxRoot) return;
  renderer.setSize(fxRoot.clientWidth, fxRoot.clientHeight);
}

/** @param {number} now DOMHighResTimeStamp from requestAnimationFrame */
function draw(now) {
  if (lastFrameTime != null) elapsed += (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  program.uniforms.uTime.value = elapsed;
  renderer.render({ scene: mesh });
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
    lastFrameTime = null; // skip delta on first post-resume frame
    rafId = requestAnimationFrame(draw);
  }
}

/**
 * Ambient OGL aurora wash behind the panel grid, one tier below dataRain.
 * Renders a fullscreen-triangle fragment shader (3-octave value-noise FBM,
 * three color layers) at half resolution via `Renderer({ dpr: 0.5 })` — a
 * deliberately soft, blurred ambient layer rather than a crisp one.
 *
 * Silent no-op if `[data-fx-root]` isn't present, or if a WebGL context
 * can't be created (OGL's `Renderer` throws when neither `webgl2` nor
 * `webgl` contexts are available, e.g. jsdom under test — this is caught
 * rather than left to crash the mount).
 *
 * invariant: this canvas must be the very first child of `[data-fx-root]`
 * — *before* dataRain's canvas when both are mounted. Both modules always
 * `insertBefore(canvas, fxRoot.firstChild)`, so whichever mounts later ends
 * up frontmost in the DOM regardless of prior mount order; since dataRain
 * is unlocked earlier in the fx ladder than aurora, it mounts first, and
 * aurora's later `insertBefore` pushes it ahead — leaving aurora painted
 * first (furthest back) and dataRain painted after (on top), as intended.
 * @param {{ root: Document, starTier?: number }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  const target = root.querySelector(FX_ROOT_SELECTOR);
  if (!target) return;

  const auroraCanvas = document.createElement('canvas');
  auroraCanvas.setAttribute('data-fx-aurora', '1');
  Object.assign(auroraCanvas.style, {
    position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
    zIndex: '0', pointerEvents: 'none',
  });

  let auroraRenderer;
  try {
    auroraRenderer = new Renderer({ canvas: auroraCanvas, dpr: AURORA_DPR, alpha: true, premultipliedAlpha: false });
  } catch {
    return; // no WebGL context available in this environment
  }
  if (!auroraRenderer.gl) return;

  const gl = auroraRenderer.gl;
  const geometry = new Triangle(gl);
  const starTier = ctx?.starTier ?? 0;
  const auroraProgram = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.5 + 0.1 * starTier },
    },
  });
  const auroraMesh = new Mesh(gl, { geometry, program: auroraProgram });

  fxRoot = target;
  canvas = auroraCanvas;
  renderer = auroraRenderer;
  program = auroraProgram;
  mesh = auroraMesh;
  active = true;

  fxRoot.insertBefore(canvas, fxRoot.firstChild);
  resize();
  elapsed = 0;
  lastFrameTime = null; // skip delta on the first frame of a fresh mount
  rafId = requestAnimationFrame(draw);

  onResize = () => resize();
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
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  canvas?.remove();
  canvas = null;
  renderer = null;
  program = null;
  mesh = null;
  fxRoot = null;
  elapsed = 0;
  active = false;
}
