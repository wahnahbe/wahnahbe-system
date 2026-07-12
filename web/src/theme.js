export const C = {
  bg: '#08050F', panel: 'rgba(22,12,40,0.72)', mag: '#D24BFF', cyan: '#3FE8FF',
  text: '#F2EAFF', deep: 'rgba(11,7,22,.9)', dim: 'rgba(242,234,255,.5)',
  magBorder: 'rgba(210,75,255,.45)', cyanDim: 'rgba(63,232,255,.6)',
};
export const fonts = {
  display: "'Rajdhani',sans-serif", mono: "'Share Tech Mono',monospace", jp: "'Noto Sans JP',sans-serif",
};
export const clip = (n) =>
  `polygon(${n}px 0,100% 0,100% calc(100% - ${n}px),calc(100% - ${n}px) 100%,0 100%,0 ${n}px)`;
export const panelStyle = {
  display: 'flex', flexDirection: 'column', background: C.panel, backdropFilter: 'blur(8px)',
  border: `1px solid ${C.magBorder}`, clipPath: clip(14),
  boxShadow: 'inset 0 0 26px rgba(210,75,255,.06)', overflow: 'hidden',
};
