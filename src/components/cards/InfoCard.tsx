import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { dirName, enuToAltAz, toENU, type BodyPos, type Frame } from '../../lib/astro/coords';
import { moonPhaseName, riseSet, type TonightInfo } from '../../lib/astro/tonight';
import type { City, SkyData } from '../../lib/data/load';
import { brightnessWord, formatDistanceAU, formatLy, lightLeft, phTime } from '../../lib/format';
import type { Selection } from '../../lib/selection';

type Props = {
  data: SkyData;
  city: City;
  date: Date;
  frame: Frame;
  bodies: BodyPos[];
  tonight: TonightInfo;
  selected: Selection | null;
  onBack: () => void;
};
type CollapseProps = { open: boolean; setOpen: (open: boolean) => void };

const position = (alt: number, az: number) => (alt > 0 ? `${dirName(az)} · ${Math.round(alt)}° up` : 'below the horizon');
const time = (d: Date | null | undefined) => (d ? phTime(d) : '—');

function Collapse({ open, setOpen }: CollapseProps) {
  return (
    <button
      type="button"
      className="ui-icon small"
      aria-expanded={open}
      aria-label={open ? 'Hide details' : 'Show details'}
      onClick={() => setOpen(!open)}
    >
      {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </button>
  );
}

export function InfoCard(props: Props) {
  const [open, setOpen] = useState(true);
  return (
    <section className="ui-card info-card" aria-label={props.selected ? 'Details' : `Tonight over ${props.city.name}`}>
      {props.selected ? (
        <ObjectDetails {...props} selected={props.selected} open={open} setOpen={setOpen} />
      ) : (
        <TonightDetails {...props} open={open} setOpen={setOpen} />
      )}
    </section>
  );
}

function TonightDetails({ city, tonight, open, setOpen }: Props & CollapseProps) {
  const moon = tonight.moon;
  return (
    <>
      <div className="card-head">
        <p className="card-kicker">Tonight over {city.name}</p>
        <Collapse open={open} setOpen={setOpen} />
      </div>
      {open && (
        <>
          <ul className="rows">
            <li>
              <span className="k">Sunset</span>
              <span className="v">{time(tonight.sunset)}</span>
            </li>
            <li>
              <span className="k">Fully dark</span>
              <span className="v">{time(tonight.dark)}</span>
            </li>
            <li>
              <span className="k">Sky</span>
              <span className="v">{city.quality}</span>
            </li>
            {moon && (
              <li>
                <span className="k">Moon</span>
                <span className="v planet-text">
                  {moonPhaseName(moon.phase)} · {Math.round(moon.fraction * 100)}%{moon.alt <= 0 ? ' · not up' : ''}
                </span>
              </li>
            )}
            <li>
              <span className="k">Planets up</span>
              <span className="v planet-text">
                {tonight.up.length ? tonight.up.map((p) => `${p.id} (${p.dir})`).join(', ') : 'none right now'}
              </span>
            </li>
            {tonight.later.map((p) => (
              <li key={p.id}>
                <span className="k">{p.id}</span>
                <span className="v">rises {phTime(p.rise)}</span>
              </li>
            ))}
            <li>
              <span className="k">Polaris</span>
              <span className="v">{Math.round(city.lat)}° up · north</span>
            </li>
          </ul>
          <p className="note">Drag the sky to look around. Tap a star or planet for details.</p>
        </>
      )}
    </>
  );
}

function ObjectDetails({
  data,
  city,
  date,
  frame,
  bodies,
  selected,
  onBack,
  open,
  setOpen,
}: Props & CollapseProps & { selected: Selection }) {
  const conNames = useMemo(() => new Map(data.constellations.map((c) => [c.id, c.name])), [data]);
  const times = useMemo(() => (selected.kind === 'body' ? riseSet(selected.id, city, date) : null), [selected, city, date]);

  let title = '';
  let sub = '';
  let facts: Array<[string, string]> = [];
  let note = '';
  let swatch: string | undefined;

  if (selected.kind === 'star') {
    const s = data.stars;
    const i = selected.index;
    const enu = [0, 0, 0];
    toENU(frame, s.x[i], s.y[i], s.z[i], enu);
    const { alt, az } = enuToAltAz(enu[0], enu[1], enu[2]);
    const dist = s.dist[i];
    title = s.name[i] || 'Unnamed star';
    sub = conNames.get(s.con[i]) ?? s.con[i];
    swatch = s.color[i];
    facts = [
      ['Distance', dist == null ? 'unknown' : formatLy(dist)],
      ['Temperature', s.temp[i] ? `~${s.temp[i].toLocaleString('en-US')} K` : 'unknown'],
      ['Brightness', `${brightnessWord(s.mag[i])} · mag ${s.mag[i].toFixed(1)}`],
      ['Position', position(alt, az)],
    ];
    note = dist == null ? '' : `The light you see left this star ${lightLeft(dist)}.`;
  } else {
    const b = bodies.find((x) => x.id === selected.id);
    title = selected.id;
    if (b && b.id === 'Moon') {
      sub = moonPhaseName(b.phase);
      facts = [
        ['Lit', `${Math.round(b.fraction * 100)}%`],
        ['Distance', formatDistanceAU(b.dist)],
        ['Rises', time(times?.rise)],
        ['Sets', time(times?.set)],
        ['Position', position(b.alt, b.az)],
      ];
      note = b.fraction > 0.7 ? 'Bright tonight, so faint stars are harder to see.' : 'A dimmer Moon leaves the sky darker for stargazing.';
    } else if (b) {
      sub = 'Planet';
      facts = [
        ['Brightness', `mag ${b.mag.toFixed(1)}`],
        ['Distance', formatDistanceAU(b.dist)],
        ['Rises', time(times?.rise)],
        ['Sets', time(times?.set)],
        ['Position', position(b.alt, b.az)],
      ];
      note = 'Planets shine with a steady light, while stars twinkle.';
    }
  }

  return (
    <>
      <div className="card-head">
        <p className="card-title">
          {swatch && <span className="swatch" style={{ background: swatch }} aria-hidden="true" />}
          {title}
        </p>
        <span className="card-sub">{sub}</span>
        <Collapse open={open} setOpen={setOpen} />
      </div>
      {open && (
        <>
          <dl className="facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {note && <p className="note">{note}</p>}
          <div className="card-actions">
            <button type="button" className="ui-pill" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" />
              Tonight
            </button>
          </div>
        </>
      )}
    </>
  );
}