import { CONT_LETTER, WAKE_MIN, hhmm } from "../engine/state";
import type { Note, Side, State } from "../types";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, text?: string | null) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ?fast をつけると待ち時間が短くなる（動作確認用）
const params = new URLSearchParams(location.search);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const SPEED = params.has("fast") ? 0.08 : REDUCED ? 0.35 : 1;
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * SPEED));

export const BOSS = { name: "黒崎 玲司", short: "黒崎", ini: "黒", bg: "var(--av-ptr)" };

interface ChatItem {
  id: string;
  name: string;
  ini: string;
  bg: string;
  pv: string;
  tm: string;
  unread: number;
  cur?: boolean;
}
export const CHATS: ChatItem[] = [
  { id: "ptr", name: "黒崎 玲司（パートナー）", ini: "黒", bg: "var(--av-ptr)", pv: "明日のレビューの前に、Orionの話を聞きたい", tm: "21:40", unread: 0, cur: true },
  { id: "team", name: "【Orion】チーム", ini: "O", bg: "var(--av-grp)", pv: "早瀬：定例資料v8、上げました", tm: "21:12", unread: 0 },
  { id: "cli", name: "森田部長（東邦ロジスティクス）", ini: "森", bg: "var(--av-cli)", pv: "明日もよろしくお願いいたします", tm: "18:05", unread: 0 },
  { id: "hr", name: "人事", ini: "人", bg: "var(--av-hr)", pv: "勤怠の締め日のお知らせ", tm: "金", unread: 0 },
  { id: "fam", name: "家族", ini: "家", bg: "var(--av-fam)", pv: "ごはん、冷蔵庫に入れておくね", tm: "19:30", unread: 0 },
];

export function renderList(): void {
  const ul = $("chatList");
  ul.textContent = "";
  for (const c of CHATS) {
    const li = el("li", c.cur ? "cur" : null);
    const av = el("div", "av", c.ini);
    av.style.background = c.bg;
    const mid = el("div");
    mid.style.minWidth = "0";
    mid.append(el("div", "nm", c.name), el("div", "pv", c.pv));
    const r = el("div");
    r.style.display = "flex";
    r.style.flexDirection = "column";
    r.append(el("span", "tm num", c.tm));
    if (c.unread) r.append(el("span", "unread num", String(c.unread)));
    li.append(av, mid, r);
    ul.append(li);
  }
}

function chatFor(from: string): ChatItem {
  if (/森田|東邦/.test(from)) return CHATS[2];
  if (/人事|勤怠/.test(from)) return CHATS[3];
  if (/家族/.test(from)) return CHATS[4];
  return CHATS[1];
}

export function toast(s: Side, minute: number): void {
  const t = el("div", "toast");
  t.append(el("small", null, s.from), document.createTextNode(s.text));
  $("toasts").append(t);
  setTimeout(() => t.remove(), 4200 * Math.max(SPEED, 0.5));
  const c = chatFor(s.from);
  c.pv = s.text.replace(/^[^：]+：/, "");
  c.tm = hhmm(minute);
  c.unread++;
  renderList();
}

// ---- メッセージ ----
let lastFrom: "boss" | "me" | null = null;

export function scroll(): void {
  const log = $("log");
  log.scrollTop = log.scrollHeight;
}

export function bossRow(text: string, minute: number, newGroup = false): HTMLElement {
  const log = $("log");
  const b = el("div", "bub", text);
  if (lastFrom === "boss" && !newGroup) {
    const c = el("div", "cont");
    c.append(b);
    log.append(c);
  } else {
    const row = el("div", "row");
    const av = el("div", "av", BOSS.ini);
    av.style.background = BOSS.bg;
    const col = el("div", "col");
    const meta = el("div", "meta");
    meta.append(el("b", null, BOSS.name), document.createTextNode(hhmm(minute)));
    col.append(meta, b);
    row.append(av, col);
    log.append(row);
  }
  lastFrom = "boss";
  scroll();
  return b;
}

function fileKind(name: string): "x" | "p" | "d" {
  return /xlsx$/.test(name) ? "x" : /pdf$/.test(name) ? "p" : "d";
}

export function fileCard(name: string, size: string): HTMLElement {
  const f = el("div", "file");
  const k = fileKind(name);
  f.append(el("div", "ic " + k, k === "x" ? "XLS" : k === "p" ? "PDF" : "DOC"));
  const t = el("div");
  t.append(el("div", "nm", name), el("small", null, size));
  f.append(t);
  return f;
}

export function myRow(text: string | null, minute: number, file?: string): void {
  const w = el("div", "mine");
  w.append(el("div", "meta num", hhmm(minute)));
  if (file) w.append(fileCard(file, /xlsx$/.test(file) ? "1.4 MB" : "320 KB"));
  if (text) w.append(el("div", "bub", text));
  w.append(el("div", "seen", "既読"));
  $("log").append(w);
  lastFrom = "me";
  scroll();
}

export function noteRow(note: Note): void {
  const log = $("log");
  const host = el("div", "cont");
  host.style.display = "flex";
  host.style.flexDirection = "column";
  host.style.gap = "6px";
  host.style.alignItems = "flex-start";
  host.append(fileCard(note.file, "1.1 MB"));
  const s = el("div", "scrawl");
  note.lines.forEach((l, i) => {
    if (i) s.append(el("br"));
    s.append(document.createTextNode(l));
  });
  host.append(s);
  log.append(host);
  scroll();
}

export function sys(text: string): void {
  $("log").append(el("div", "sys", text));
  lastFrom = null;
  scroll();
}

export function day(text: string): void {
  $("log").append(el("div", "day", text));
}

export function resetLog(): void {
  $("log").textContent = "";
  lastFrom = null;
}

export function typing(on: boolean): void {
  let t = document.getElementById("typing");
  if (!t) {
    t = el("div", "typing");
    t.id = "typing";
    $("log").after(t);
  }
  t.textContent = on ? `${BOSS.short}さんが入力中…` : "";
}

// ---- メーター ----
function color(v: number, bad: number, warn: number, higherIsBad = false): string {
  const isBad = higherIsBad ? v >= bad : v <= bad;
  const isWarn = higherIsBad ? v >= warn : v <= warn;
  return isBad ? "var(--alert)" : isWarn ? "var(--lamp)" : "var(--ok)";
}

function setMeter(id: string, v: number, prev?: number): void {
  const m = $(id);
  const bar = m.querySelector("i") as HTMLElement;
  bar.style.width = v + "%";
  bar.style.background = color(v, 25, 50);
  (m.querySelector(".v") as HTMLElement).textContent = String(v);
  if (prev != null && v < prev) {
    m.classList.add("hit");
    setTimeout(() => m.classList.remove("hit"), 500);
  }
}

export function renderMeters(s: State, prev?: { hp: number; trust: number }): void {
  setMeter("mHp", s.hp, prev?.hp);
  setMeter("mTrust", s.trust, prev?.trust);
  const left = Math.max(0, WAKE_MIN - s.minute);
  $("sleepLeft").textContent = `${Math.floor(left / 60)}:${left % 60 < 10 ? "0" : ""}${left % 60}`;
  $("sleepLeft").style.color = color(left, 300, 360);
  $("gmV").textContent = s.gm + "%";
  $("gmV").style.color = s.gm < 20 ? "var(--alert)" : s.gm < 30 ? "var(--lamp)" : "var(--ok)";
  $("utilV").textContent = s.util + "%";
  $("utilV").style.color = color(s.util, 120, 100, true);
  $("contV").textContent = CONT_LETTER[s.cont];
  $("contV").style.color = s.cont <= 1 ? "var(--alert)" : s.cont === 2 ? "var(--lamp)" : "var(--ok)";
  $("clock").textContent = hhmm(s.minute);
}

// ---- 通知音 ----
let ctx: AudioContext | null = null;
let soundOn = true;
export function toggleSound(): boolean {
  soundOn = !soundOn;
  return soundOn;
}
export function ping(kind: "msg" | "call" = "msg"): void {
  if (!soundOn) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = kind === "call" ? 660 : 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "call" ? 0.5 : 0.15));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  } catch {
    // 音が出せない環境では何もしない
  }
}
