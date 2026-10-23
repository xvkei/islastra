import { eqUnit } from '../astro/coords';

export type City = {
  id: string;
  name: string;
  province: string;
  lat: number;
  lon: number;
  landscape: 'hills' | 'coast' | 'mountains';
  water?: [number, number];
  glow: number;
  limitMag: number;
  quality: string;
  lights: Array<[number, number, number]>;
};

/** Stars in parallel arrays (fast to loop over), sorted brightest first. */
export type Stars = {
  count: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  mag: Float32Array;
  color: string[];
  temp: number[];
  dist: Array<number | null>;
  absmag: Array<number | null>;
  name: string[];
  con: string[];
  named: number[];
};

export type Constellation = {
  id: string;
  name: string;
  label: [number, number, number];
  lines: Float64Array[]; // x, y, z triplets
};

export type SkyData = { stars: Stars; constellations: Constellation[]; cities: City[] };

type StarFile = { fields: string[]; stars: Array<Array<number | string | null>> };
type ConFile = Array<{ id: string; name: string; label: [number, number]; lines: Array<Array<[number, number]>> }>;

async function getJSON<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Couldn't load ${file} (error ${res.status}).`);
  return (await res.json()) as T;
}

function parseStars(f: StarFile): Stars {
  const col = Object.fromEntries(f.fields.map((k, i) => [k, i])) as Record<string, number>;
  const n = f.stars.length;
  const st: Stars = {
    count: n,
    x: new Float64Array(n),
    y: new Float64Array(n),
    z: new Float64Array(n),
    mag: new Float32Array(n),
    color: new Array<string>(n),
    temp: new Array<number>(n),
    dist: new Array<number | null>(n),
    absmag: new Array<number | null>(n),
    name: new Array<string>(n),
    con: new Array<string>(n),
    named: [],
  };
  f.stars.forEach((row, i) => {
    const [x, y, z] = eqUnit(Number(row[col.ra]), Number(row[col.dec]));
    st.x[i] = x;
    st.y[i] = y;
    st.z[i] = z;
    st.mag[i] = Number(row[col.mag]);
    st.color[i] = String(row[col.color] ?? '#ffffff');
    st.temp[i] = Number(row[col.temp]) || 0;
    st.dist[i] = row[col.dist] == null ? null : Number(row[col.dist]);
    st.absmag[i] = row[col.absmag] == null ? null : Number(row[col.absmag]);
    st.name[i] = String(row[col.name] ?? '');
    st.con[i] = String(row[col.con] ?? '');
    if (st.name[i]) st.named.push(i);
  });
  return st;
}

function parseConstellations(f: ConFile): Constellation[] {
  return f.map((c) => ({
    id: c.id,
    name: c.name,
    label: eqUnit(c.label[0], c.label[1]),
    lines: c.lines.map((line) => {
      const arr = new Float64Array(line.length * 3);
      line.forEach(([ra, dec], j) => arr.set(eqUnit(ra, dec), j * 3));
      return arr;
    }),
  }));
}

export async function loadSkyData(): Promise<SkyData> {
  const [stars, cons, cities] = await Promise.all([
    getJSON<StarFile>('stars.json'),
    getJSON<ConFile>('constellations.json'),
    getJSON<City[]>('cities.json'),
  ]);
  return { stars: parseStars(stars), constellations: parseConstellations(cons), cities };
}