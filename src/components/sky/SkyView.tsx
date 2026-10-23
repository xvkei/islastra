import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { bodyPositions, horizonFrame } from '../../lib/astro/coords';
import type { City, SkyData } from '../../lib/data/load';
import { readPalette, type Palette } from '../../lib/palette';
import { renderSky, type View } from './renderSky';

const PITCH_MIN = -8;
const PITCH_MAX = 90;
const FOV_MIN = 30;
const FOV_MAX = 110;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Props = { data: SkyData; city: City; date: Date };

export function SkyView({ data, city, date }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ yaw: 180, pitch: 15, fov: 90 }); // facing south, tilted up a little
  const palette = useRef<Palette | null>(null);
  const raf = useRef(0);

  const frame = useMemo(() => horizonFrame(date, city.lat, city.lon), [date, city]);
  const bodies = useMemo(() => bodyPositions(date, city.lat, city.lon), [date, city]);

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
    const dir = renderSky(ctx, w, h, palette.current, view.current, data, city, frame, bodies);
    cv.setAttribute('aria-label', `Night sky over ${city.name}, looking ${dir}. Drag, or use the arrow keys, to look around.`);
  }, [data, city, frame, bodies]);

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

  // drag to look around and up; the wheel zooms
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let drag: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('is-dragging');
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const k = view.current.fov / cv.clientWidth;
      view.current.yaw = drag.yaw - (e.clientX - drag.x) * k;
      view.current.pitch = clamp(drag.pitch + (e.clientY - drag.y) * k, PITCH_MIN, PITCH_MAX);
      requestDraw();
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      cv.classList.remove('is-dragging');
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
      default:
        used = false;
    }
    if (used) {
      e.preventDefault();
      requestDraw();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="sky-canvas"
      tabIndex={0}
      role="img"
      aria-label={`Night sky over ${city.name}`}
      onKeyDown={onKeyDown}
    />
  );
}