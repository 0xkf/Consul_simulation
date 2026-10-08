import { CALL, CLOSERS, DEADLINE, MEETS, OPENERS, POOL, SECRET, SIDES, SPECIAL } from "../data/rounds";
import type { Len, Rng, Scheduled, Slot } from "../types";
import { pick, shuffle } from "./rand";
import { START_MIN } from "./state";

export const T0 = START_MIN + 3; // 最初のメッセージ 22:33
export const T1 = 25 * 60 + 40; // 最後のメッセージ 1:40 ごろ

// 1晩の組み立て：順番はランダム、山場の位置は固定
//   導入 → 通常回（メモの回 → 1〜2回あとに28時 / 電話 / 会議中を差し込む）→ 締め
export function buildNight(len: Len, rng: Rng): Scheduled[] {
  const n = (len === "short" ? 4 : 7) - 1; // 会議中の回の分を1つ減らす
  const mid: Slot[] = shuffle(POOL, rng).slice(0, n);

  const special = rng() < 0.08 ? SECRET : pick(SPECIAL, rng);
  const spIdx = 1 + Math.floor(rng() * 3);
  mid.splice(spIdx, 0, special);
  mid.splice(spIdx + 1 + Math.floor(rng() * 2), 0, DEADLINE);
  mid.splice(2 + Math.floor(rng() * 5), 0, CALL);
  mid.splice(1 + Math.floor(rng() * (mid.length - 1)), 0, pick(MEETS, rng));

  const night: Slot[] = [pick(OPENERS, rng), ...mid, pick(CLOSERS, rng)];
  const sides = shuffle(SIDES, rng).slice(0, 5);
  const last = night.length - 1;
  return night.map((r, i) => {
    const jitter = i > 0 && i < last ? Math.floor(rng() * 6) - 3 : 0;
    const c: Scheduled = { ...r, t: Math.round(T0 + ((T1 - T0) * i) / last) + jitter };
    if (i > 0 && i < last && i % 2 === 0 && sides.length) c.side = sides.shift();
    return c;
  });
}
