import type { BodyId } from './astro/coords';

/** What the visitor has tapped: a star (by its index in the star data) or the Moon/a planet. */
export type Selection = { kind: 'star'; index: number } | { kind: 'body'; id: BodyId };

export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b) return false;
  if (a.kind === 'star' && b.kind === 'star') return a.index === b.index;
  if (a.kind === 'body' && b.kind === 'body') return a.id === b.id;
  return false;
}