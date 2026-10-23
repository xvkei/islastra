import { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Orbit, Tag, Waypoints } from 'lucide-react';
import { InfoCard } from './components/cards/InfoCard';
import { StarList } from './components/cards/StarList';
import { LocationPicker } from './components/controls/LocationPicker';
import { TimeSlider } from './components/controls/TimeSlider';
import { SkyView } from './components/sky/SkyView';
import { skyState, type Show } from './components/sky/renderSky';
import { bodyPositions, horizonFrame } from './lib/astro/coords';
import { tonightInfo } from './lib/astro/tonight';
import { aboveHorizon } from './lib/astro/visible';
import { loadSkyData, type SkyData } from './lib/data/load';
import { phDay, phTime, tonightStart } from './lib/format';
import { buildLandscape } from './lib/scene/landscape';
import type { Selection } from './lib/selection';
import './styles/sky.css';
import './styles/overlay.css';

const CITY_KEY = 'islastra.city';

function readCity(): string {
  try {
    return localStorage.getItem(CITY_KEY) ?? 'manila';
  } catch {
    return 'manila';
  }
}

export function App() {
  const [data, setData] = useState<SkyData | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(true);
  const [scrub, setScrub] = useState(0);
  const [cityId, setCityId] = useState(readCity);
  const [show, setShow] = useState<Show>({ lines: true, labels: true, planets: true });
  const [selected, setSelected] = useState<Selection | null>(null);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    loadSkyData()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong loading the sky.'));
  }, []);

  // keep "now" current
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const base = useMemo(() => tonightStart(now), [now]);
  const date = useMemo(() => new Date(live ? now : base + scrub * 60_000), [live, now, base, scrub]);
  const city = data ? (data.cities.find((c) => c.id === cityId) ?? data.cities[0]) : null;
  const frame = useMemo(() => (city ? horizonFrame(date, city.lat, city.lon) : null), [date, city]);
  const bodies = useMemo(() => (city ? bodyPositions(date, city.lat, city.lon) : []), [date, city]);
  const landscape = useMemo(() => (city ? buildLandscape(city) : null), [city]);
  const tonight = useMemo(() => (city ? tonightInfo(city, base, date, bodies) : null), [city, base, date, bodies]);
  const listItems = useMemo(
    () => (data && city && frame && listOpen ? aboveHorizon(data, frame, bodies, skyState(city, bodies).limit) : []),
    [data, city, frame, bodies, listOpen],
  );

  const chooseCity = useCallback((id: string) => {
    setCityId(id);
    setSelected(null);
    try {
      localStorage.setItem(CITY_KEY, id);
    } catch {
      /* storage blocked: still works for this visit */
    }
  }, []);

  const toggle = (key: keyof Show) => setShow((s) => ({ ...s, [key]: !s[key] }));

  if (error) return <p className="loading">{error}</p>;
  if (!data || !city || !frame || !landscape || !tonight) return <p className="loading">loading the sky…</p>;

  const sliderValue = live ? Math.min(720, Math.max(0, Math.round((now - base) / 60_000))) : scrub;

  return (
    <main className="app">
      <h1 className="sr-only">Islastra: the night sky over {city.name}</h1>

      <SkyView
        data={data}
        city={city}
        frame={frame}
        bodies={bodies}
        landscape={landscape}
        show={show}
        selected={selected}
        onSelect={setSelected}
      />

      <div className="topbar-left">
        <span className="brand">islastra</span>
        <LocationPicker cities={data.cities} value={city.id} onChange={chooseCity} />
        <span className="ui-pill chip">
          {phDay(date)} · {phTime(date)}
        </span>
        <button type="button" className="ui-pill" aria-pressed={live} onClick={() => setLive(true)}>
          Now
        </button>
      </div>

      <div className="topbar-right">
        <button type="button" className="ui-icon" aria-pressed={show.lines} aria-label="Constellations" title="Constellations" onClick={() => toggle('lines')}>
          <Waypoints size={16} aria-hidden="true" />
        </button>
        <button type="button" className="ui-icon" aria-pressed={show.labels} aria-label="Star names" title="Star names" onClick={() => toggle('labels')}>
          <Tag size={16} aria-hidden="true" />
        </button>
        <button type="button" className="ui-icon" aria-pressed={show.planets} aria-label="Moon and planets" title="Moon and planets" onClick={() => toggle('planets')}>
          <Orbit size={16} aria-hidden="true" />
        </button>
        <button type="button" className="ui-icon" aria-pressed={listOpen} aria-label="List view" title="List view" onClick={() => setListOpen((o) => !o)}>
          <List size={16} aria-hidden="true" />
        </button>
      </div>

      <InfoCard
        data={data}
        city={city}
        date={date}
        frame={frame}
        bodies={bodies}
        tonight={tonight}
        selected={selected}
        onBack={() => setSelected(null)}
      />

      {listOpen && <StarList items={listItems} onPick={setSelected} onClose={() => setListOpen(false)} />}

      <TimeSlider
        value={sliderValue}
        date={date}
        onChange={(v) => {
          setLive(false);
          setScrub(v);
        }}
      />
    </main>
  );
}