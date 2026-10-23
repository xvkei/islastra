import { RAD } from './coords';

/** A view of the sky: looking toward azimuth `yaw`, tilted up by `pitch`, with a horizontal field of view. */
export type Camera = {
  cx: number;
  cy: number;
  scale: number;
  f: [number, number, number];
  r: [number, number, number];
  u: [number, number, number];
};

export function makeCamera(yawDeg: number, pitchDeg: number, fovDeg: number, w: number, h: number): Camera {
  const y = yawDeg * RAD;
  const p = pitchDeg * RAD;
  const sy = Math.sin(y);
  const cyaw = Math.cos(y);
  const sp = Math.sin(p);
  const cp = Math.cos(p);
  return {
    cx: w / 2,
    cy: h / 2,
    scale: w / 2 / (2 * Math.tan((fovDeg * RAD) / 4)),
    f: [sy * cp, cyaw * cp, sp], // forward
    r: [cyaw, -sy, 0], // right
    u: [-sy * sp, -cyaw * sp, cp], // up
  };
}

/**
 * Stereographic projection around the view direction: keeps constellation
 * shapes natural even near the edges and when looking straight up.
 */
export function project(c: Camera, e: number, n: number, u: number) {
  const X = e * c.r[0] + n * c.r[1] + u * c.r[2];
  const Y = e * c.u[0] + n * c.u[1] + u * c.u[2];
  const Z = e * c.f[0] + n * c.f[1] + u * c.f[2];
  if (Z < -0.2) return null; // behind you
  const k = 2 / (1 + Z);
  return { x: c.cx + c.scale * k * X, y: c.cy - c.scale * k * Y, z: Z };
}