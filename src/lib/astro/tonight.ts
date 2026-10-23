import * as Astronomy from 'astronomy-engine';
import type { City } from '../data/load';
import { dirName, mod, type BodyId, type BodyPos } from './coords';

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

export function moonPhaseName(phaseDeg: number): string {
  return PHASES[Math.round(mod(phaseDeg, 360) / 45) % 8];
}

export type TonightInfo = {
  sunset: Date | null;
  dark: Date | null;
  up: Array<{ id: BodyId; dir: string }>;
  later: Array<{ id: BodyId; rise: Date }>;
  moon: BodyPos | undefined;
};

/** Sunset, full darkness, and which planets are up or rising later tonight. */
export function tonightInfo(city: City, base: number, date: Date, bodies: BodyPos[]): TonightInfo {
  const obs = new Astronomy.Observer(city.lat, city.lon, 0);
  const noon = new Date(base - 6 * 3600_000);
  const sunset = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, noon, 1)?.date ?? null;
  const dark = Astronomy.SearchAltitude(Astronomy.Body.Sun, obs, -1, noon, 1, -18)?.date ?? null;
  const planets = bodies.filter((b) => b.id !== 'Sun' && b.id !== 'Moon');
  const end = base + 12 * 3600_000;
  const later = planets
    .filter((b) => b.alt <= 0)
    .flatMap((b) => {
      const t = Astronomy.SearchRiseSet(Astronomy.Body[b.id], obs, +1, date, 1);
      return t && t.date.getTime() < end ? [{ id: b.id, rise: t.date }] : [];
    });
  return {
    sunset,
    dark,
    up: planets.filter((b) => b.alt > 0).map((b) => ({ id: b.id, dir: dirName(b.az) })),
    later,
    moon: bodies.find((b) => b.id === 'Moon'),
  };
}

/** Next rise and set within a day, for the object card. */
export function riseSet(id: BodyId, city: City, date: Date) {
  const obs = new Astronomy.Observer(city.lat, city.lon, 0);
  const body = Astronomy.Body[id];
  return {
    rise: Astronomy.SearchRiseSet(body, obs, +1, date, 1)?.date ?? null,
    set: Astronomy.SearchRiseSet(body, obs, -1, date, 1)?.date ?? null,
  };
}