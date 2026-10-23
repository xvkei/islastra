import { X } from 'lucide-react';
import { dirName } from '../../lib/astro/coords';
import type { Listed } from '../../lib/astro/visible';
import type { Selection } from '../../lib/selection';

type Props = { items: Listed[]; onPick: (sel: Selection) => void; onClose: () => void };

export function StarList({ items, onPick, onClose }: Props) {
  return (
    <section className="ui-card list-panel" aria-labelledby="list-title">
      <div className="list-head">
        <h2 id="list-title">Above the horizon</h2>
        <button type="button" className="ui-icon small" aria-label="Close list" onClick={onClose} autoFocus>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="note">Nothing bright is up right now.</p>
      ) : (
        <ol className="list-items">
          {items.map((it) => (
            <li key={it.sel.kind === 'star' ? `s${it.sel.index}` : it.sel.id}>
              <button type="button" className="list-item" onClick={() => onPick(it.sel)}>
                <span>{it.name}</span>
                <span className="muted">
                  {it.kind} · {dirName(it.az)} · {Math.round(it.alt)}° up
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}