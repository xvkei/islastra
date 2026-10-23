const KEYS = [
  'ground', 'ground2', 'panel', 'line', 'text', 'muted', 'soft', 'accent', 'planet', 'sun', 'water',
  'con-line', 'con-name', 'city-light', 'sky-glow', 'sky-zenith', 'sky-night-top', 'sky-night-bottom',
  'sky-twilight-top', 'sky-twilight-bottom', 'sky-day-top', 'sky-day-bottom',
] as const;

export type Palette = Record<(typeof KEYS)[number], string>;

/** Reads the colour tokens from tokens.css, so the canvas uses the same palette as the CSS. */
export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Palette;
  for (const k of KEYS) out[k] = cs.getPropertyValue(`--${k}`).trim() || '#000000';
  return out;
}

function parse(hex: string): number[] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two #rrggbb colours; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a;
  const k = Math.min(1, Math.max(0, t));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}