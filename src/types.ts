// ステータスの変化量。省略した項目は変化なし。
export interface Fx {
  trust?: number; // 信頼 0〜100
  hp?: number; // メンタル 0〜100
  gm?: number; // 粗利率（%ポイント）
  util?: number; // チーム稼働率（%ポイント）
  cont?: number; // 継続確度（段階。E=0 〜 A=4）
  sorry?: number; // 謝った回数
}

// file: 黙ってファイルだけ送る / none: 何も送らない（行動だけ）
export type Send = "file" | "none";

export interface Option {
  text: string;
  fx: Fx;
  re: string[]; // 黒崎の返し
  send?: Send;
  file?: string; // send: "file" で送るファイル名
  miss?: boolean; // 会議中に時間切れになったときに選ばれる手
}

// パートナーが転送してくる手書きメモ付きのファイル
export interface Note {
  file: string;
  lines: string[];
}

export interface Round {
  id: string;
  msgs: string[];
  opts: Option[];
  burst?: boolean; // 間を置かずに連投
  note?: Note;
  deadline?: boolean; // 「28時」の締切を言い渡す回
  pause?: boolean; // 入力中…が出たり消えたりする
  deleted?: boolean; // 送信取り消しを挟む
  meet?: boolean; // 会議中の裏チャット（時間制限あり）
  intro?: string; // 会議中の回の前置き
}

export interface CallSlot {
  id: "call";
  call: true;
}

export type Slot = Round | CallSlot;

export interface Side {
  from: string;
  text: string;
}

// 1晩のなかで実際に出る回（時刻と横から来る通知つき）
export type Scheduled = Slot & { t: number; side?: Side };

export type Diff = "easy" | "normal" | "hell";
export type Len = "normal" | "short";

export interface State {
  round: number;
  minute: number; // 0時からの経過分（24時以降は 24*60 を超える）
  hp: number;
  trust: number;
  gm: number;
  util: number;
  cont: number;
  sorry: number;
  nag: number; // 催促された回数
  grilled: number; // 詰められた（メッセージを受けた）回数
  good: number; // 信頼が上がった返し
  answers: number;
  yes: number; // 「承知」「はい」から始めた回数
  free: number; // 自由入力の回数
  egg: number; // 隠し反応の回数
  kw: number; // 中身のない「結論」の回数
  waza: number; // 「結論」とだけ送った回数
  deadlineSaid: boolean;
  ver: number; // 収支表の版
  used: Record<string, string[]>;
  usedRe: string[];
}

export type EndingKind = "renew" | "swap" | "red" | "monday" | "sleep";

export type Rng = () => number;

export interface Reply {
  fx: Fx;
  re: string[];
  egg?: boolean;
  patch?: boolean; // 「結論」だけ送る技を初めて使った
}
