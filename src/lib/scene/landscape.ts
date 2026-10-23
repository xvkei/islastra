import { mod } from '../astro/coords';
import type { City } from '../data/load';

export type Tree = { az: number; kind: 'palm' | 'pine'; size: number };
export type Light = { az: number; alt: number; r: number; a: number };
export type Landscape = {
  /** top of the land in degrees above the horizon, for an azimuth */
  height: (az: number) => number;
  /** 0 = land, 1 = open water, in between near the shore */
  water: (az: number) => number;
  trees: Tree[];
  lights: Light[];
};

const RAD = Math.PI / 180;

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function seedFrom(text: string) {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 233280;
  return h;
}

function angDist(a: number, b: number) {
  const d = mod(a - b, 360);
  return Math.min(d, 360 - d);
}

function inRange(az: number, a0: number, a1: number) {
  const x = mod(az, 360);
  return a1 >= a0 ? x >= a0 && x <= a1 : x >= a0 || x <= a1;
}

export function buildLandscape(city: City): Landscape {
  const water = (az: number) => {
    if (!city.water) return 0;
    const [a0, a1] = city.water;
    if (!inRange(az, a0, a1)) return 0;
    return Math.min(1, Math.min(angDist(az, a0), angDist(az, a1)) / 8);
  };

  const land = (az: number) => {
    const x = az * RAD;
    switch (city.landscape) {
      case 'mountains':
        return 3 + 2.2 * Math.abs(Math.sin(x * 4.5 + 0.5)) + 1.3 * Math.abs(Math.sin(x * 11)) + 0.4 * Math.sin(x * 37);
      case 'coast':
        return 0.8 + 0.6 * Math.sin(x * 9) + 0.3 * Math.sin(x * 23);
      default:
        return 1 + 0.8 * Math.sin(x * 7) + 0.5 * Math.sin(x * 17 + 1) + 0.25 * Math.sin(x * 43);
    }
  };

  const height = (az: number) => {
    const w = water(az);
    return Math.max(0.1, land(az)) * (1 - w) + 0.04 * w;
  };

  const rand = makeRng(seedFrom(city.id));

  const trees: Tree[] = [];
  const kind = city.landscape === 'mountains' ? 'pine' : 'palm';
  for (let az = rand() * 20; az < 360; az += 10 + rand() * 22) {
    if (water(az) > 0.2) continue;
    trees.push({ az, kind, size: 0.8 + rand() * 0.5 });
    if (kind === 'pine' && rand() < 0.6) trees.push({ az: az + 1.6 + rand(), kind, size: 0.6 + rand() * 0.3 });
  }

  const lights: Light[] = [];
  for (const [a0, a1, n] of city.lights) {
    const span = mod(a1 - a0, 360) || 360;
    for (let i = 0; i < n; i++) {
      const az = mod(a0 + rand() * span, 360);
      const onWater = water(az) > 0.4;
      lights.push({
        az,
        // towns across water sit on the far shore; otherwise just below the skyline
        alt: onWater ? height(az) + 0.03 : height(az) - 0.15 - rand() * 0.9,
        r: 0.6 + rand() * 0.9,
        a: 0.45 + rand() * 0.55,
      });
    }
  }

  return { height, water, trees, lights };
}