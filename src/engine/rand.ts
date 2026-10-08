import type { Rng, State } from "../types";

export function shuffle<T>(a: readonly T[], rng: Rng): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function pick<T>(a: readonly T[], rng: Rng): T {
  return a[Math.floor(rng() * a.length)];
}

// 同じ台詞を1回のプレイで繰り返さない（使い切ったらリセット）
export function pickNew(a: readonly string[], key: string, s: State, rng: Rng): string {
  const used = (s.used[key] ??= []);
  let left = a.filter((x) => !used.includes(x));
  if (!left.length) {
    used.length = 0;
    left = a.slice();
  }
  const x = pick(left, rng);
  used.push(x);
  return x;
}

// テスト用：シードつきの乱数（mulberry32）
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
