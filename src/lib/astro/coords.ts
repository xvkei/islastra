import * as Astronomy from 'astronomy-engine';

export const RAD = Math.PI / 180;
export const mod = (a: number, n: number) => ((a % n) + n) % n;

const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
/** Compass direction name for an azimuth in degrees. */
export const dirName = (az: number) => DIRS[Math.round(mod(az, 360) / 45) % 8];

/** Unit vector on the sky for right ascension and declination in degrees (equatorial frame). */
export function eqUnit(raDeg: number, decDeg: number): [number, number, number] {
  const ra = raDeg * RAD;
  const dec = decDeg * RAD;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}

/** East/north/up unit vector for an altitude and azimuth in degrees (azimuth from north, through east). */
export function altAzToENU(altDeg: number, azDeg: number): [number, number, number] {
  const alt = altDeg * RAD;
  const az = azDeg * RAD;
  const c = Math.cos(alt);
  return [c * Math.sin(az), c * Math.cos(az), Math.sin(alt)];
}

export function enuToAltAz(e: number, n: number, u: number) {
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) / RAD, az: mod(Math.atan2(e, n) / RAD, 360) };
}

/** What's needed to turn fixed sky positions into local east/north/up for one place and moment. */
export type Frame = { sT: number; cT: number; sP: number; cP: number };

export function horizonFrame(date: Date, latDeg: number, lonDeg: number): Frame {
  const lst = mod(Astronomy.SiderealTime(date) * 15 + lonDeg, 360) * RAD; // local sidereal time
  const lat = latDeg * RAD;
  return { sT: Math.sin(lst), cT: Math.cos(lst), sP: Math.sin(lat), cP: Math.cos(lat) };
}

/** Equatorial unit vector → east/north/up, written into out[0..2]. No allocations, for the star loop. */
export function toENU(f: Frame, x: number, y: number, z: number, out: number[]) {
  const ch = x * f.cT + y * f.sT; // cos(dec) · cos(hour angle)
  const sh = x * f.sT - y * f.cT; // cos(dec) · sin(hour angle)
  out[0] = -sh;
  out[1] = z * f.cP - ch * f.sP;
  out[2] = z * f.sP + ch * f.cP;
}

export const BODY_IDS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type BodyId = (typeof BODY_IDS)[number];
export type BodyPos = { id: BodyId; alt: number; az: number; mag: number; phase: number; fraction: number; dist: number };

/** Where the Sun, Moon and naked-eye planets are, as seen from a place at a moment. `dist` is in AU. */
export function bodyPositions(date: Date, lat: number, lon: number): BodyPos[] {
  const observer = new Astronomy.Observer(lat, lon, 0);
  return BODY_IDS.map((id) => {
    const body = Astronomy.Body[id];
    const eq = Astronomy.Equator(body, date, observer, true, true);
    const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
    const ill = id === 'Sun' ? null : Astronomy.Illumination(body, date);
    return {
      id,
      alt: hor.altitude,
      az: hor.azimuth,
      mag: ill ? ill.mag : -26.7,
      phase: id === 'Moon' ? Astronomy.MoonPhase(date) : 0,
      fraction: ill ? ill.phase_fraction : 1,
      dist: eq.dist,
    };
  });
}