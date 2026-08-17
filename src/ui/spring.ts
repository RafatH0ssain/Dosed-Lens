/**
 * Springs for gesture-driven UI.
 *
 * Parameterised the way Apple exposes it to designers rather than as the
 * physics triplet: `damping` is the damping ratio (1 = critically damped,
 * settles with no overshoot; below 1 bounces) and `response` is roughly how
 * long the value takes to reach the target in seconds. A spring has no fixed
 * duration — settle time emerges from the two.
 *
 * Why a spring and not a CSS transition: a transition interpolates from a
 * value captured when it started, so grabbing an element mid-flight makes it
 * jump. A spring always integrates from its *current* value and velocity, so
 * re-targeting mid-motion is continuous — which is what makes a sheet feel
 * grabbable while it is still moving.
 */

/** One cycle of the integrator. Small enough that a stiff spring stays stable. */
const SUBSTEP = 1 / 240;
/** A long frame (tab switch, jank) must not be integrated in one leap. */
const MAX_FRAME = 1 / 30;

export interface SpringConfig {
  /** Damping ratio. 1 = critically damped (default), < 1 overshoots. */
  damping?: number;
  /** Seconds to approach the target. Lower is snappier. */
  response?: number;
  /**
   * Rest threshold, in the same units as the value. Defaults suit pixels;
   * a 0..1 normalised spring wants something much smaller.
   */
  epsilon?: number;
}

const reduceMotion = (): boolean =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Spring {
  damping: number;
  response: number;
  private epsilon: number;

  private _value: number;
  private _velocity = 0;
  private _target: number;

  private raf = 0;
  private last = 0;

  constructor(
    initial: number,
    private onFrame: (value: number) => void,
    cfg: SpringConfig = {},
  ) {
    this._value = initial;
    this._target = initial;
    this.damping = cfg.damping ?? 1;
    this.response = cfg.response ?? 0.4;
    this.epsilon = cfg.epsilon ?? 0.05;
  }

  get value(): number {
    return this._value;
  }
  get velocity(): number {
    return this._velocity;
  }
  get target(): number {
    return this._target;
  }
  get moving(): boolean {
    return this.raf !== 0;
  }

  /**
   * Drive the value directly, as during a 1:1 drag. Keeps the spring out of
   * the way but records velocity, so a later release can hand it straight off.
   */
  track(value: number, velocity = 0): void {
    this.stop();
    this._value = value;
    this._velocity = velocity;
    this.onFrame(value);
  }

  /** Jump with no motion at all (resize, mode switch, reduced motion). */
  snap(value: number): void {
    this.stop();
    this._value = this._target = value;
    this._velocity = 0;
    this.onFrame(value);
  }

  /**
   * Animate to `target`, optionally entering at a known velocity — pass the
   * pointer's release velocity here so there is no seam between the drag and
   * the animation that follows it.
   */
  to(target: number, velocity?: number): void {
    this._target = target;
    if (velocity !== undefined) this._velocity = velocity;
    if (reduceMotion()) {
      this.snap(target);
      return;
    }
    if (this.raf === 0) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  stop(): void {
    if (this.raf !== 0) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private tick = (now: number): void => {
    const frame = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;

    const omega = (2 * Math.PI) / this.response;
    const steps = Math.max(1, Math.ceil(frame / SUBSTEP));
    const h = frame / steps;
    for (let i = 0; i < steps; i++) {
      const accel =
        -omega * omega * (this._value - this._target) -
        2 * this.damping * omega * this._velocity;
      this._velocity += accel * h;
      this._value += this._velocity * h;
    }

    if (
      Math.abs(this._value - this._target) < this.epsilon &&
      Math.abs(this._velocity) < this.epsilon
    ) {
      this.raf = 0;
      this._value = this._target;
      this._velocity = 0;
      this.onFrame(this._value);
      return;
    }

    this.onFrame(this._value);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/**
 * Where a flick would come to rest, as scroll deceleration does it. Snap to
 * the target nearest this point rather than the one nearest the release
 * point — that is what makes a flick feel thrown instead of dropped.
 *
 * The exponential-decay form Apple ships, not the textbook v²/2a.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary. A hard stop reads as frozen; easing
 * off reads as responsive with nothing more to give.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
  );
}

/**
 * Pointer velocity in units/second from a short position history. Sampling the
 * last couple of moves rather than the final pair keeps a single stuttering
 * event from throwing the estimate.
 */
export class VelocityTracker {
  private samples: Array<{ v: number; t: number }> = [];

  reset(value: number): void {
    this.samples = [{ v: value, t: performance.now() }];
  }

  add(value: number): void {
    const t = performance.now();
    this.samples.push({ v: value, t });
    // keep ~100ms of history; older samples say nothing about the release
    while (this.samples.length > 2 && t - this.samples[0].t > 100) {
      this.samples.shift();
    }
  }

  /** Units per second. Zero when there is nothing meaningful to measure. */
  get velocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
  }
}
