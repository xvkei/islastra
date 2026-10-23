import { altAzToENU, dirName, mod, toENU, type BodyPos, type Frame } from '../../lib/astro/coords';
import { makeCamera, project, type Camera } from '../../lib/astro/projection';
import type { City, SkyData } from '../../lib/data/load';
import { mix, type Palette } from '../../lib/palette';
import type { Landscape } from '../../lib/scene/landscape';
import type { Selection } from '../../lib/selection';

export type View = { yaw: number; pitch: number; fov: number };
export type Show = { lines: boolean; labels: boolean; planets: boolean };
export type Hit = { x: number; y: number; sel: Selection };
export type SkyInput = {
  pal: Palette;
  view: View;
  data: SkyData;
  city: City;
  frame: Frame;
  bodies: BodyPos[];
  landscape: Landscape;
  show: Show;
  selected: Selection | null;
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COMPASS: Array<[string, number]> = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const PLANET_R: Partial<Record<string, number>> = { Mercury: 2.2, Venus: 3.8, Mars: 2.8, Jupiter: 3.6, Saturn: 3.2 };
const RAD = Math.PI / 180;
const WATER_DEPTH = -3.5; // how far below the horizon the water reaches, in degrees
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const angDist = (a: number, b: number) => {
  const d = mod(a - b, 360);
  return Math.min(d, 360 - d);
};

function at(cam: Camera, alt: number, az: number) {
  const v = altAzToENU(alt, az);
  return project(cam, v[0], v[1], v[2]);
}

function visible(x: number, y: number, w: number, h: number, margin = 24) {
  return x > -margin && x < w + margin && y > -margin && y < h + margin;
}

/** How dark it is and how faint the stars you can see are, after city lights, the Moon and twilight. */
export function skyState(city: City, bodies: BodyPos[]) {
  const sun = bodies.find((b) => b.id === 'Sun');
  const moon = bodies.find((b) => b.id === 'Moon');
  const sunAlt = sun ? sun.alt : -90;
  const night = clamp((-sunAlt - 2) / 16, 0, 1); // 1 once the Sun is 18° below the horizon
  const day = clamp((sunAlt + 4) / 10, 0, 1); // 1 once the Sun is 6° up
  const starsVis = clamp((-sunAlt - 4) / 10, 0, 1);
  const moonDim = moon && moon.alt > 0 ? moon.fraction * 0.5 : 0;
  const limit = city.limitMag - moonDim - (1 - starsVis) * 2.5;
  return { night, day, starsVis, limit, moon };
}

/** Moon with its real phase: lit on the right while waxing, on the left while waning. */
function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phaseDeg: number, fraction: number, colour: string) {
  const litRight = phaseDeg < 180;
  ctx.fillStyle = colour;
  ctx.save();
  ctx.globalAlpha *= 0.18;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const rx = r * Math.abs(1 - 2 * fraction);
  const passLeft = (litRight && fraction > 0.5) || (!litRight && fraction <= 0.5);
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !litRight);
  if (passLeft) ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
  else ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lean: number) {
  const tx = x + lean * s * 0.35;
  const ty = y - s * 2.4;
  ctx.lineWidth = Math.max(1.6, s * 0.16);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.05, y - s * 1.3, tx, ty);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, s * 0.12);
  const fronds: Array<[number, number]> = [[-1.3, 0.35], [1.3, 0.4], [-0.95, 0.85], [0.95, 0.9], [-0.35, -0.6], [0.5, -0.55]];
  for (const [dx, dy] of fronds) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + dx * s * 0.5, ty - s * 0.45 + dy * s * 0.15, tx + dx * s, ty + dy * s);
    ctx.stroke();
  }
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
  for (let i = 0; i < 3; i++) {
    const half = s * (0.55 - i * 0.13);
    const base = y - s * (0.35 + i * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - half, base);
    ctx.lineTo(x, base - s * 0.85);
    ctx.lineTo(x + half, base);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draws one frame. Returns the direction you're facing (for screen readers) and where tappable things are. */
export function renderSky(ctx: CanvasRenderingContext2D, w: number, h: number, input: SkyInput): { dir: string; hits: Hit[] } {
  const { pal, view, data, city, frame, bodies, landscape: L, show, selected } = input;
  const cam = makeCamera(view.yaw, view.pitch, view.fov, w, h);
  const { night, day, starsVis, limit, moon } = skyState(city, bodies);
  const zoom = Math.sqrt(clamp(90 / view.fov, 0.8, 2.2));
  const pxPerDeg = cam.scale * 2 * Math.tan(0.5 * RAD);
  const span = Math.min(180, view.fov / 2 + 60);
  const enu = [0, 0, 0];
  const hits: Hit[] = [];
  let ring: { x: number; y: number; r: number } | null = null;

  // 1. sky colour follows the Sun; city glow stays low, near the horizon
  const top = mix(mix(mix(pal['sky-twilight-top'], pal['sky-night-top'], night), pal['sky-zenith'], night * 0.6), pal['sky-day-top'], day);
  const bottom = mix(mix(pal['sky-twilight-bottom'], pal['sky-night-bottom'], night), pal['sky-day-bottom'], day);
  const glow = mix(bottom, pal['sky-glow'], city.glow * 0.4 * night);
  const yHor = at(cam, 0, view.yaw)?.y ?? h;
  const yHigh = at(cam, 75, view.yaw)?.y ?? 0;
  const grad = ctx.createLinearGradient(0, Math.min(yHigh, yHor - 1), 0, yHor);
  grad.addColorStop(0, top);
  grad.addColorStop(0.6, mix(top, bottom, 0.35));
  grad.addColorStop(0.88, mix(bottom, glow, 0.5));
  grad.addColorStop(1, glow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (starsVis > 0) {
    const s = data.stars;

    // 2. stars
    for (let i = 0; i < s.count; i++) {
      const mag = s.mag[i];
      if (mag > limit) break; // sorted brightest first, so everything after is fainter
      toENU(frame, s.x[i], s.y[i], s.z[i], enu);
      if (enu[2] < -0.02) continue;
      const p = project(cam, enu[0], enu[1], enu[2]);
      if (!p || !visible(p.x, p.y, w, h)) continue;
      const r = Math.max(0.9, 3.3 - 0.42 * mag) * zoom;
      const low = clamp(enu[2] * 10 + 0.45, 0.45, 1);
      ctx.globalAlpha = clamp(0.55 + (limit - mag) * 0.25, 0.5, 1) * starsVis * low;
      ctx.fillStyle = s.color[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (mag < 1.5) {
        ctx.globalAlpha *= 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.name[i]) hits.push({ x: p.x, y: p.y, sel: { kind: 'star', index: i } });
    }

    // 3. constellation lines and names
    if (show.lines) {
      ctx.globalAlpha = 0.45 * starsVis;
      ctx.strokeStyle = pal['con-line'];
      ctx.lineWidth = 0.8;
      for (const c of data.constellations) {
        for (const line of c.lines) {
          ctx.beginPath();
          let pen = false;
          for (let j = 0; j < line.length; j += 3) {
            toENU(frame, line[j], line[j + 1], line[j + 2], enu);
            const p = enu[2] > -0.08 ? project(cam, enu[0], enu[1], enu[2]) : null;
            if (!p) {
              pen = false;
              continue;
            }
            if (pen) ctx.lineTo(p.x, p.y);
            else {
              ctx.moveTo(p.x, p.y);
              pen = true;
            }
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.8 * starsVis;
      ctx.font = `italic 12px ${FONT}`;
      ctx.fillStyle = pal['con-name'];
      ctx.textAlign = 'center';
      for (const c of data.constellations) {
        toENU(frame, c.label[0], c.label[1], c.label[2], enu);
        if (enu[2] < 0.04) continue;
        const p = project(cam, enu[0], enu[1], enu[2]);
        if (p && visible(p.x, p.y, w, h, 0)) ctx.fillText(c.name, p.x, p.y);
      }
    }

    // 4. names of the brightest stars
    if (show.labels) {
      ctx.globalAlpha = starsVis;
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = pal.soft;
      ctx.textAlign = 'left';
      for (const i of s.named) {
        if (s.mag[i] > Math.min(limit, 1.6)) continue;
        toENU(frame, s.x[i], s.y[i], s.z[i], enu);
        if (enu[2] < 0.02) continue;
        const p = project(cam, enu[0], enu[1], enu[2]);
        if (p && visible(p.x, p.y, w, h, 0)) ctx.fillText(s.name[i], p.x + 8, p.y + 4);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (selected?.kind === 'star') {
    const s = data.stars;
    const i = selected.index;
    toENU(frame, s.x[i], s.y[i], s.z[i], enu);
    const p = enu[2] > -0.02 ? project(cam, enu[0], enu[1], enu[2]) : null;
    if (p) ring = { x: p.x, y: p.y, r: 11 * zoom };
  }

  // 5. Sun, Moon and planets
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  for (const b of bodies) {
    if (b.alt < -1) continue;
    if (b.id !== 'Sun' && !show.planets) continue;
    const p = at(cam, b.alt, b.az);
    if (!p || !visible(p.x, p.y, w, h, 40)) continue;
    if (b.id === 'Sun') {
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 * zoom, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const alpha = b.id === 'Moon' ? 1 : clamp(starsVis * 1.3 + (b.mag < -3 ? 0.6 : 0), 0, 1);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    if (b.id === 'Moon') {
      drawMoon(ctx, p.x, p.y, 10 * zoom, b.phase, b.fraction, pal.planet);
    } else {
      const r = (PLANET_R[b.id] ?? 2.5) * zoom;
      ctx.fillStyle = pal.planet;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (b.id === 'Saturn') {
        ctx.strokeStyle = pal.planet;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 2.3, r * 0.75, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = pal.planet;
    ctx.fillText(b.id, p.x + (b.id === 'Moon' ? 15 : 9) * zoom, p.y + 4);
    ctx.globalAlpha = 1;
    hits.push({ x: p.x, y: p.y, sel: { kind: 'body', id: b.id } });
    if (selected?.kind === 'body' && selected.id === b.id) ring = { x: p.x, y: p.y, r: (b.id === 'Moon' ? 15 : 11) * zoom };
  }

  // selection ring in the accent colour
  if (ring) {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 6. the land, following this place's skyline
  const topPts: number[] = [];
  for (let a = -span; a <= span; a += 1) {
    const az = view.yaw + a;
    const p = at(cam, L.height(az), az);
    if (p) topPts.push(p.x, p.y);
  }
  if (topPts.length >= 4) {
    ctx.fillStyle = pal.ground;
    ctx.beginPath();
    ctx.moveTo(topPts[0], h + 80);
    for (let i = 0; i < topPts.length; i += 2) ctx.lineTo(topPts[i], topPts[i + 1]);
    ctx.lineTo(topPts[topPts.length - 2], h + 80);
    ctx.closePath();
    ctx.fill();
  }

  // 7. water (sea or lake) and the Moon's reflection on it
  if (city.water) {
    const runs: number[][] = [];
    let run: number[] = [];
    for (let a = -span; a <= span; a += 1) {
      const az = view.yaw + a;
      if (L.water(az) >= 0.5) run.push(az);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
    ctx.fillStyle = pal.water;
    for (const r of runs) {
      ctx.beginPath();
      let started = false;
      for (const az of r) {
        const p = at(cam, L.height(az) - 0.02, az);
        if (!p) continue;
        if (started) ctx.lineTo(p.x, p.y);
        else {
          ctx.moveTo(p.x, p.y);
          started = true;
        }
      }
      for (let i = r.length - 1; i >= 0; i--) {
        const p = at(cam, WATER_DEPTH, r[i]);
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
    }
    if (moon && moon.alt > 0 && show.planets && L.water(moon.az) >= 0.5) {
      ctx.strokeStyle = pal.planet;
      ctx.lineWidth = 1.4;
      for (let alt = -0.15; alt > WATER_DEPTH + 0.1; alt -= 0.18) {
        const p = at(cam, alt, moon.az);
        if (!p) continue;
        const f = 1 + alt / -WATER_DEPTH; // 1 near the horizon, 0 at the shore
        ctx.globalAlpha = 0.5 * clamp(f, 0, 1) * clamp(moon.fraction * 1.2, 0.2, 1);
        const half = (2 + ((Math.round(-alt * 100) * 7) % 9)) * zoom * (0.8 + (1 - f) * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x - half, p.y);
        ctx.lineTo(p.x + half, p.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // 8. city lights, brighter once it's fully dark
  ctx.fillStyle = pal['city-light'];
  for (const l of L.lights) {
    if (angDist(l.az, view.yaw) > span) continue;
    const p = at(cam, l.alt, l.az);
    if (!p || !visible(p.x, p.y, w, h, 4)) continue;
    ctx.globalAlpha = l.a * (0.35 + 0.65 * night);
    ctx.beginPath();
    ctx.arc(p.x, p.y, l.r * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 9. trees along the skyline
  ctx.fillStyle = pal.ground;
  ctx.strokeStyle = pal.ground;
  for (const t of L.trees) {
    if (angDist(t.az, view.yaw) > span) continue;
    const base = at(cam, L.height(t.az) - 0.2, t.az);
    if (!base || !visible(base.x, base.y, w, h, 80)) continue;
    const s = t.size * pxPerDeg;
    if (t.kind === 'pine') drawPine(ctx, base.x, base.y, s);
    else drawPalm(ctx, base.x, base.y, s, Math.round(t.az) % 2 ? 1 : -1);
  }

  // 10. compass directions, written on the ground
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.muted;
  for (const [label, az] of COMPASS) {
    const p = at(cam, Math.min(L.height(az), 0.5) - 2.2, az);
    if (!p || !visible(p.x, p.y, w, h, 0)) continue;
    ctx.font = label.length === 1 ? `500 14px ${FONT}` : `12px ${FONT}`;
    ctx.fillText(label, p.x, p.y);
  }

  // 11. zenith marker, straight overhead
  const zp = project(cam, 0, 0, 1);
  if (zp && visible(zp.x, zp.y, w, h, -10)) {
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(zp.x, zp.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = pal.muted;
    ctx.fillText('zenith', zp.x, zp.y + 22);
  }
  ctx.textAlign = 'left';

  return { dir: dirName(view.yaw), hits };
}