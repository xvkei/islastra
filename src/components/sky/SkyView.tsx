import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { BodyPos, Frame } from '../../lib/astro/coords';
import type { City, SkyData } from '../../lib/data/load';
import { readPalette, type Palette } from '../../lib/palette';
import type { Landscape } from '../../lib/scene/landscape';
import type { Selection } from '../../lib/selection';
import { renderSky, type Hit, type Show, type View } from './renderSky';

const PITCH_MIN = -8;
const PITCH_MAX = 90;
const FOV_MIN = 30;
const FOV_MAX = 110;
const TAP_RADIUS = 22;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Props = {
  data: SkyData;
  city: City;
  frame: Frame;
  bodies: BodyPos[];
  landscape: Landscape;
  show: Show;
  selected: Selection | null;
  onSelect: (sel: Selection | null) => void;
};

export function SkyView({ data, city, frame, bodies, landscape, show, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ yaw: 180, pitch: 15, fov: 90 }); // facing south, tilted up a little
  const palette = useRef<Palette | null>(null);
  const raf = useRef(0);
  const hits = useRef<Hit[]>([]);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;
    palette.current ??= readPalette();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const out = renderSky(ctx, w, h, { pal: palette.current, view: view.current, data, city, frame, bodies, landscape, show, selected });
    hits.current = out.hits;
    cv.setAttribute('aria-label', `Night sky over ${city.name}, looking ${out.dir}. Drag, or use the arrow keys, to look around.`);
  }, [data, city, frame, bodies, landscape, show, selected]);

  // only redraw when something changed, at most once per animation frame
  const drawRef = useRef(draw);
  const requestDraw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      drawRef.current();
    });
  }, []);

  useEffect(() => {
    drawRef.current = draw;
    requestDraw();
  }, [draw, requestDraw]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => requestDraw());
    ro.observe(cv);
    return () => ro.disconnect();
  }, [requestDraw]);

  // drag to look around, pinch or wheel to zoom, tap to select
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    let pinch: { d: number; fov: number } | null = null;
    let moved = false;
    const gap = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cv.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
        moved = false;
        cv.classList.add('is-dragging');
      } else if (pointers.size === 2) {
        pinch = { d: gap(), fov: view.current.fov };
        drag = null;
        moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        view.current.fov = clamp(pinch.fov * (pinch.d / gap()), FOV_MIN, FOV_MAX);
        requestDraw();
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      const k = view.current.fov / cv.clientWidth;
      view.current.yaw = drag.yaw - dx * k;
      view.current.pitch = clamp(drag.pitch + dy * k, PITCH_MIN, PITCH_MAX);
      requestDraw();
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const tap = drag !== null && !moved && pointers.size === 1 && e.type === 'pointerup';
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        drag = null;
        cv.classList.remove('is-dragging');
      }
      if (tap) {
        const rect = cv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best: Hit | null = null;
        let bestD = TAP_RADIUS;
        for (const hit of hits.current) {
          const d = Math.hypot(hit.x - x, hit.y - y);
          if (d < bestD) {
            bestD = d;
            best = hit;
          }
        }
        onSelectRef.current(best ? best.sel : null);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      view.current.fov = clamp(view.current.fov * Math.exp(e.deltaY * 0.001), FOV_MIN, FOV_MAX);
      requestDraw();
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('wheel', wheel);
    };
  }, [requestDraw]);

  const nudge = (dyaw: number, dpitch: number) => {
    view.current.yaw += dyaw;
    view.current.pitch = clamp(view.current.pitch + dpitch, PITCH_MIN, PITCH_MAX);
    requestDraw();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const v = view.current;
    let used = true;
    switch (e.key) {
      case 'ArrowLeft':
        v.yaw -= 10;
        break;
      case 'ArrowRight':
        v.yaw += 10;
        break;
      case 'ArrowUp':
        v.pitch = clamp(v.pitch + 5, PITCH_MIN, PITCH_MAX);
        break;
      case 'ArrowDown':
        v.pitch = clamp(v.pitch - 5, PITCH_MIN, PITCH_MAX);
        break;
      case '+':
      case '=':
        v.fov = clamp(v.fov / 1.15, FOV_MIN, FOV_MAX);
        break;
      case '-':
      case '_':
        v.fov = clamp(v.fov * 1.15, FOV_MIN, FOV_MAX);
        break;
      case 'Escape':
        onSelectRef.current(null);
        break;
      default:
        used = false;
    }
    if (used) {
      e.preventDefault();
      requestDraw();
    }
  };

  return (
    <div className="sky">
      <canvas
        ref={canvasRef}
        className="sky-canvas"
        tabIndex={0}
        role="img"
        aria-label={`Night sky over ${city.name}`}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="ui-icon look look-left" aria-label="Look left" onClick={() => nudge(-20, 0)}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div className="look look-right">
        <button type="button" className="ui-icon" aria-label="Look up" onClick={() => nudge(0, 10)}>
          <ChevronUp size={18} aria-hidden="true" />
        </button>
        <button type="button" className="ui-icon" aria-label="Look right" onClick={() => nudge(20, 0)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="ui-icon" aria-label="Look down" onClick={() => nudge(0, -10)}>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}