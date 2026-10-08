import type { EndingKind, Rng, State } from "../types";
import { pick } from "./rand";

// 締めの回のあとの判定。メンタルが尽きたときは途中で "sleep"
export function decide(s: State): EndingKind {
  if (s.trust >= 80 && s.cont >= 3) return "renew";
  if (s.trust <= 30) return "swap";
  if (s.gm < 20) return "red";
  return "monday";
}

export const FINAL_LINES: Record<Exclude<EndingKind, "sleep">, string[]> = {
  renew: ["明日の定例、次のフェーズの話は桐生からして", "取れたら、来期のSM昇格の推薦は俺が書く"],
  swap: ["明日の定例は俺が出る", "桐生はPMOに専念して", "来週、アサインの件で話そう"],
  red: ["明日の案件レビュー、Orionは名前を読み上げられる", "覚悟しておいて"],
  monday: ["じゃあ明日9時の定例。13時から案件レビュー", "遅れないで"],
};

export const SLEEP_LINES = ["桐生", "?", "寝た？", "……定例は俺が出る"];

export const ENDINGS: Record<EndingKind, { h: string; p: string }> = {
  renew: {
    h: "次のフェーズを任された",
    p: "黒崎さんから「定例で、次のフェーズの話は桐生から」。SM昇格の推薦も書くと言われた。",
  },
  swap: { h: "定例は黒崎さんが出ることに", p: "桐生は来週からPMO。Orionの前線からは外れた。" },
  red: { h: "案件レビューで名指し", p: "粗利{gm}%。明日の案件レビューで、Orionは「要改善案件」として読み上げられる。" },
  monday: { h: "月曜が来た", p: "9時に定例、13時に案件レビュー。何も解決していないが、朝は来る。" },
  sleep: { h: "寝落ちした", p: "メンタルが尽きた。最後のメッセージに既読は付かなかった。" },
};

export function badge(kind: EndingKind, s: State): string {
  if (kind === "sleep") return "睡眠欲の勝利";
  if (kind === "renew") return "SM昇格候補";
  if (kind === "swap") return "PMO送り";
  if (kind === "red") return "赤字請負人";
  if (s.util >= 140) return "チーム酷使の常習犯";
  if (s.nag >= 4) return "既読スルーの達人";
  if (s.sorry >= 2) return "謝罪のプロ";
  if (s.cont >= 3) return "継続の鬼";
  return "詰め耐性 B";
}

// 適性の5項目（それぞれ1〜5）
export function aptitude(kind: EndingKind, s: State): [string, number][] {
  const cl = (v: number) => Math.max(1, Math.min(5, Math.round(v)));
  const ans = Math.max(1, s.answers);
  return [
    ["面の皮の厚さ", cl(4 - s.sorry + (s.free ? 1 : 0) + (s.egg ? 1 : 0))],
    ["詰められても平気な生命力", kind === "sleep" ? 1 : cl(s.hp / 20 + 0.5)],
    ["数字で返す力", cl((s.good / ans) * 5 + 0.5)],
    ["即レス力", cl(5 - s.nag)],
    ["「承知しました」力", cl(1 + s.yes)],
  ];
}

// 3週間後の昇格会議での一言
const LATER = {
  good: ["桐生は、数字で話せるようになった", "次のフェーズ、桐生に任せてみる", "まだ荒いけど、逃げない"],
  bad: ["桐生？ 資料はきれいだよ", "悪い人じゃないんだけどね", "もう1年、Mで様子を見よう"],
};
export const GOOD_NIGHT = "おやすみ。明日、期待してる";
export const SOFT_NIGHT = ["じゃあ、明日", "寝られるうちに寝て", "以上"];

export function laterQuote(good: boolean, rng: Rng): string {
  return pick(good ? LATER.good : LATER.bad, rng);
}
