export enum LaunchState {
  WAITING = 'WAITING',
  WAVE_DETECTED = 'WAVE_DETECTED',
  HEART_DETECTED = 'HEART_DETECTED',
  LAUNCHING = 'LAUNCHING',
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  hue: number;
}