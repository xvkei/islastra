import { phTime } from '../../lib/format';

type Props = { value: number; date: Date; onChange: (minutes: number) => void };

/** Scrub through tonight, from 6 PM to 6 AM. `value` is minutes after 6 PM. */
export function TimeSlider({ value, date, onChange }: Props) {
  return (
    <div className="ui-card time-bar">
      <span className="muted">6 PM</span>
      <input
        type="range"
        min={0}
        max={720}
        step={5}
        value={value}
        aria-label="Time tonight"
        aria-valuetext={phTime(date)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="muted">6 AM</span>
    </div>
  );
}