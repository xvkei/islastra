import { altAzToENU, mod, toENU, type BodyPos, type Frame } from '../../lib/astro/coords';
import { makeCamera, project, type Camera } from '../../lib/astro/projection';
import type { City, SkyData } from '../../lib/data/load';
import { mix, type Palette } from '../../lib/palette';

export type View = { yaw: number; pitch: number; fov: number };

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COMPASS: Array<[string, number]> = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const DIR_NAMES = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const PLANET_R: Partial<Record<string, number>> = { Mercury: 2.2, Venus: 3.8, Mars: 2.8, Jupiter: 3.6, Saturn: 3.2 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function at(cam: Camera, alt: number, az: number) {
  const v = altAzToENU(alt, az);
  return project(cam, v[0], v[1], v[2]);
}

function visible(x: number, y: number, w: number, h: number, margin = 24) {
  return x > -margin && x < w + margin && y > -margin && y < h + margin;
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

/** Draws one frame of the sky. Returns the compass direction you're facing, for screen readers. */
export function renderSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: Palette,
  view: View,
  data: SkyData,
  city: City,
  frame: Frame,
  bodies: BodyPos[],
): string {
  const cam = makeCamera(view.yaw, view.pitch, view.fov, w, h);
  const sun = bodies.find((b) => b.id === 'Sun');
  const moon = bodies.find((b) => b.id === 'Moon');
  const sunAlt = sun ? sun.alt : -90;
  const night = clamp((-sunAlt - 2) / 16, 0, 1); // 1 once the Sun is 18° below the horizon
  const day = clamp((sunAlt + 4) / 10, 0, 1); // 1 once the Sun is 6° up
  const starsVis = clamp((-sunAlt - 4) / 10, 0, 1);
  const zoom = Math.sqrt(clamp(90 / view.fov, 0.8, 2.2));
  const enu = [0, 0, 0];

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
    // a bright Moon and twilight both hide the faintest stars
    const moonDim = moon && moon.alt > 0 ? moon.fraction * 0.5 : 0;
    const limit = city.limitMag - moonDim - (1 - starsVis) * 2.5;

    // 2. stars
    for (let i = 0; i < s.count; i++) {
      const mag = s.mag[i];
      if (mag > limit) break; // sorted brightest first, so everything after is fainter
      toENU(frame, s.x[i], s.y[i], s.z[i], enu);
      if (enu[2] < -0.02) continue;
      const p = project(cam, enu[0], enu[1], enu[2]);
      if (!p || !visible(p.x, p.y, w, h)) continue;
      const r = Math.max(0.9, 3.3 - 0.42 * mag) * zoom;
      const low = clamp(enu[2] * 10 + 0.45, 0.45, 1); // a little dimmer near the horizon
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
    }

    // 3. constellation lines and names, kept soft so the stars lead
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

    // 4. names of the brightest stars
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
    ctx.globalAlpha = 1;
  }

  // 5. Sun, Moon and planets
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  for (const b of bodies) {
    if (b.alt < -1) continue;
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
  }

  // 6. the ground (flat for now; landscapes arrive in round 4)
  const span = Math.min(179, view.fov / 2 + 60);
  const pts: number[] = [];
  for (let a = -span; a <= span; a += 2) {
    const p = at(cam, 0, view.yaw + a);
    if (p) pts.push(p.x, p.y);
  }
  if (pts.length >= 4) {
    ctx.fillStyle = pal.ground;
    ctx.beginPath();
    ctx.moveTo(pts[0], h + 60);
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineTo(pts[pts.length - 2], h + 60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
      else ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.stroke();
  }

  // 7. compass directions, written on the ground
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.muted;
  for (const [label, az] of COMPASS) {
    const p = at(cam, -3, az);
    if (!p || !visible(p.x, p.y, w, h, 0)) continue;
    ctx.font = label.length === 1 ? `500 14px ${FONT}` : `12px ${FONT}`;
    ctx.fillText(label, p.x, p.y);
  }

  // 8. zenith marker, straight overhead
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

  return DIR_NAMES[Math.round(mod(view.yaw, 360) / 45) % 8];
}