import type { SkyData } from '../data/load';
import type { Selection } from '../selection';
import { enuToAltAz, toENU, type BodyPos, type Frame } from './coords';

export type Listed = { sel: Selection; name: string; kind: 'Moon' | 'planet' | 'star'; mag: number; alt: number; az: number };

/** The brightest things above the horizon right now: the Moon, planets and named stars. */
export function aboveHorizon(data: SkyData, frame: Frame, bodies: BodyPos[], limit: number, max = 30): Listed[] {
  const out: Listed[] = [];
  for (const b of bodies) {
    if (b.id === 'Sun' || b.alt <= 0) continue;
    out.push({ sel: { kind: 'body', id: b.id }, name: b.id, kind: b.id === 'Moon' ? 'Moon' : 'planet', mag: b.mag, alt: b.alt, az: b.az });
  }
  const s = data.stars;
  const enu = [0, 0, 0];
  for (const i of s.named) {
    if (s.mag[i] > limit) continue;
    toENU(frame, s.x[i], s.y[i], s.z[i], enu);
    if (enu[2] <= 0) continue;
    const { alt, az } = enuToAltAz(enu[0], enu[1], enu[2]);
    out.push({ sel: { kind: 'star', index: i }, name: s.name[i], kind: 'star', mag: s.mag[i], alt, az });
  }
  return out.sort((a, b) => a.mag - b.mag).slice(0, max);
}