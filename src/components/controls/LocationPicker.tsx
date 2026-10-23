import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import type { City } from '../../lib/data/load';

type Props = { cities: City[]; value: string; onChange: (id: string) => void };

export function LocationPicker({ cities, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = cities.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    const menu = wrap.current;
    menu?.querySelector<HTMLButtonElement>('.loc-item[aria-current="true"], .loc-item')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && menu?.contains(e.target))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.loc-item'));
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="loc" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="ui-pill"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MapPin size={14} aria-hidden="true" />
        {current?.name ?? 'Choose a place'}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="ui-card loc-menu" role="menu" aria-label="Choose a place" onKeyDown={onMenuKey}>
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              className="loc-item"
              aria-current={c.id === value ? 'true' : undefined}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
                button.current?.focus();
              }}
            >
              <span className="loc-name">
                {c.name}
                <span className="muted">{c.province}</span>
              </span>
              <span className="loc-quality">{c.quality}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}