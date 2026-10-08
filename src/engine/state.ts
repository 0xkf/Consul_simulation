import type { Diff, Fx, State } from "../types";

export const START_MIN = 22 * 60 + 30; // 日曜 22:30
export const WAKE_MIN = 31 * 60; // 月曜 7:00（起床）

export const DIFF: Record<Diff, { hp: number; loss: number; gain: number; nag: number; taunt: number; label: string }> = {
  easy: { hp: 0.6, loss: 0.8, gain: 1.1, nag: 1.6, taunt: 0.5, label: "ぬるめ" },
  normal: { hp: 1, loss: 1, gain: 1, nag: 1, taunt: 1, label: "" },
  hell: { hp: 1.3, loss: 1.25, gain: 0.85, nag: 0.7, taunt: 1.4, label: "地獄" },
};

export const CONT_LETTER = ["E", "D", "C", "B", "A"];

export function fresh(): State {
  return {
    round: 0,
    minute: START_MIN,
    hp: 100,
    trust: 50,
    gm: 23,
    util: 126,
    cont: 2,
    sorry: 0,
    nag: 0,
    grilled: 0,
    good: 0,
    answers: 0,
    yes: 0,
    free: 0,
    egg: 0,
    kw: 0,
    waza: 0,
    deadlineSaid: false,
    ver: 4,
    used: {},
    usedRe: [],
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 信頼は難易度で増減の倍率が変わる。メンタルは毎ターン最低1は減る（ラウンドが重いので変化量は0.55倍）
export function apply(s: State, fx: Fx, diff: Diff = "normal"): void {
  const D = DIFF[diff];
  const tr = fx.trust ?? 0;
  s.trust = clamp(s.trust + Math.round(tr < 0 ? tr * D.loss : tr * D.gain), 0, 100);
  const dh = Math.round((fx.hp ?? 0) * 0.55) - 1;
  s.hp = clamp(s.hp + (dh < 0 ? Math.round(dh * D.hp) : dh), 0, 100);
  s.gm = clamp(s.gm + (fx.gm ?? 0), 0, 60);
  s.util = clamp(s.util + (fx.util ?? 0), 80, 200);
  s.cont = clamp(s.cont + (fx.cont ?? 0), 0, 4);
  s.sorry += fx.sorry ?? 0;
}

export function hhmm(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h < 10 ? "0" : ""}${h}:${mm < 10 ? "0" : ""}${mm}`;
}
