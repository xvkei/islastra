const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** "8:42 PM" in Philippine time. */
export const phTime = (d: Date) => timeFmt.format(d);
/** "Fri, Oct 23" in Philippine time. */
export const phDay = (d: Date) => dayFmt.format(d);

/** 6 PM Philippine time at the start of "tonight": the night that's coming, or the one still going before 6 AM. */
export function tonightStart(now: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  let base = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 10, 0, 0); // 18:00 at UTC+8
  if (Number(p.hour) < 6) base -= 86_400_000;
  return base;
}

export function formatLy(ly: number): string {
  return ly < 100 ? `${ly.toFixed(1)} light-years` : `~${Math.round(ly).toLocaleString('en-US')} light-years`;
}

/** "around 2009" or "around 600 BC" for when a star's light set off. */
export function lightLeft(ly: number): string {
  const year = new Date().getFullYear() - Math.round(ly);
  return year > 0 ? `around ${year}` : `around ${1 - year} BC`;
}

export function formatDistanceAU(au: number): string {
  const km = au * 149_597_870.7;
  if (km < 1e6) return `~${(Math.round(km / 1000) * 1000).toLocaleString('en-US')} km`;
  if (km < 1e9) return `~${Math.round(km / 1e6)} million km`;
  return `~${(km / 1e9).toFixed(1)} billion km`;
}

export function brightnessWord(mag: number): string {
  if (mag < 0) return 'one of the brightest';
  if (mag < 1) return 'very bright';
  if (mag < 2.5) return 'bright';
  if (mag < 4) return 'moderate';
  return 'faint';
}