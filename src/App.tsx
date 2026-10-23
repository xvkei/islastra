import { useEffect, useMemo, useState } from 'react';
import { SkyView } from './components/sky/SkyView';
import { loadSkyData, type SkyData } from './lib/data/load';
import './styles/sky.css';

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function App() {
  const [data, setData] = useState<SkyData | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [offsetMin, setOffsetMin] = useState(0);

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

  // temporary time controls until the time slider arrives in round 5
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '.') setOffsetMin((m) => m + 10);
      else if (e.key === ',') setOffsetMin((m) => m - 10);
      else if (e.key === 'n') setOffsetMin(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const date = useMemo(() => new Date(now + offsetMin * 60_000), [now, offsetMin]);
  const city = data?.cities.find((c) => c.id === 'manila') ?? data?.cities[0];

  if (error) return <p className="loading">{error}</p>;
  if (!data || !city) return <p className="loading">loading the sky…</p>;

  return (
    <main className="app">
      <h1 className="sr-only">Islastra</h1>
      <SkyView data={data} city={city} date={date} />
      <p className="dev-hud">
        {city.name} · {timeFmt.format(date)} <span>· , and . change the time · n resets</span>
      </p>
    </main>
  );
}