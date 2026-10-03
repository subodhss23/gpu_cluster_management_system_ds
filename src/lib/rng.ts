export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  pickMany<T>(arr: readonly T[], count: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }

  gaussian(mean = 0, stddev = 1): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    return mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  clampRange(min: number, max: number, value: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
