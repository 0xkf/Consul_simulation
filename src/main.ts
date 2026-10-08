import "./style.css";
import { CALL_LINES, DIGS, INTERJECT, NAGS, REJECT, STORMS, TAUNTS } from "./data/rounds";
import {
  ENDINGS,
  FINAL_LINES,
  GOOD_NIGHT,
  SLEEP_LINES,
  SOFT_NIGHT,
  aptitude,
  badge,
  decide,
  laterQuote,
} from "./engine/ending";
import { buildNight } from "./engine/night";
import { pick, pickNew, shuffle } from "./engine/rand";
import { readFree } from "./engine/read";
import { CONT_LETTER, DIFF, WAKE_MIN, apply, fresh, hhmm } from "./engine/state";
import type { Diff, EndingKind, Len, Option, Reply, Round, Scheduled, State } from "./types";
import {
  $,
  BOSS,
  CHATS,
  SPEED,
  bossRow,
  day,
  el,
  myRow,
  noteRow,
  ping,
  renderList,
  renderMeters,
  resetLog,
  sys,
  toast,
  toggleSound,
  typing,
  wait,
} from "./ui/view";

const rng = Math.random;
const opt: { diff: Diff; len: Len } = { diff: "normal", len: "normal" };
let S: State = fresh();
let ROUNDS: Scheduled[] = [];
let busy = true;
let over = false;
let nagT: number | undefined;
let meetT: number | undefined;
let nagRound = 0;

const D = () => DIFF[opt.diff];

function applyFx(fx: Parameters<typeof apply>[1]): void {
  const prev = { hp: S.hp, trust: S.trust };
  apply(S, fx, opt.diff);
  renderMeters(S, prev);
}

async function say(lines: string[], o: { newGroup?: boolean; burst?: boolean } = {}): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    typing(true);
    await wait(o.burst ? 260 : 700 + Math.min(1600, lines[i].length * 45));
    typing(false);
    bossRow(lines[i], S.minute, i === 0 && !!o.newGroup);
    S.grilled++;
    ping();
    await wait(350);
  }
}

// ---- 返信の候補 ----
function chips(opts: Option[] | null): void {
  const box = $("chips");
  box.textContent = "";
  const on = !!opts;
  ($("msg") as HTMLInputElement).disabled = !on;
  ($("sendBtn") as HTMLButtonElement).disabled = !on;
  if (!opts) {
    box.append(el("span", "hint", `${BOSS.short}さんのターン。`));
    return;
  }
  for (const o of shuffle(opts, rng)) {
    const c = el("button", "chip", o.text);
    c.type = "button";
    c.addEventListener("click", () => answer(o, o.send ? null : o.text));
    box.append(c);
  }
  if (matchMedia("(min-width: 721px)").matches) $("msg").focus();
  armNag();
}

// 返信が遅いと催促（1ターン3回まで）
function armNag(): void {
  clearTimeout(nagT);
  if (over || busy || nagRound >= 3) return;
  nagT = window.setTimeout(
    () => {
      if (over || busy) return;
      nagRound++;
      S.nag++;
      bossRow(pickNew(NAGS, "nag", S, rng), S.minute);
      S.grilled++;
      ping();
      applyFx({ trust: -3, hp: -1 });
      if (S.hp <= 0) return void ending("sleep");
      armNag();
    },
    (nagRound ? 5000 : 8000) * D().nag * SPEED,
  );
}

// 会議中の裏チャット：7秒で返さないと miss の手
function meetTimer(r: Round): void {
  clearTimeout(nagT);
  clearInterval(meetT);
  let left = Math.round(7 * D().nag);
  const hint = el("span", "hint meetcount", `会議中。返せるのはあと${left}秒`);
  $("chips").prepend(hint);
  meetT = window.setInterval(() => {
    if (busy || over) return clearInterval(meetT);
    left--;
    hint.textContent = `会議中。返せるのはあと${Math.max(0, left)}秒`;
    if (left <= 0) {
      clearInterval(meetT);
      answer(r.opts.find((o) => o.miss) ?? r.opts[r.opts.length - 1], null);
    }
  }, 1000 * SPEED);
}

async function answer(o: Option | Reply, text: string | null): Promise<void> {
  if (busy || over) return;
  busy = true;
  clearTimeout(nagT);
  clearInterval(meetT);
  chips(null);
  const op = o as Option;
  if (text) myRow(text, S.minute);
  else if (op.send === "file") {
    await wait(900);
    S.ver++;
    myRow(null, S.minute, op.file ?? `Orion_収支表_v${S.ver}.xlsx`);
  } else {
    await wait(1800);
    if (op.send === "none") sys(`（${op.text.replace(/^（|）$/g, "")}）`);
  }

  applyFx(o.fx);
  S.answers++;
  if ((o.fx.trust ?? 0) > 0) S.good++;
  if (text && /^(承知|分かりました|わかりました|はい|おっしゃる通り|仰る通り|ありがとうございます)/.test(text)) S.yes++;
  await wait(900);
  if (S.hp <= 0) return ending("sleep");
  if ((o as Reply).patch) {
    sys("【お知らせ】「結論」とだけ送ると通る裏技は、修正済みです");
    await wait(900);
  }
  await say(o.re);

  // 追い打ち：悪い返しは75%（さらに35%で2発目）、良い返しにも30%でひと言
  const bad = (o.fx.trust ?? 0) < 0;
  const tm = D().taunt;
  if (!over && rng() < Math.min(0.95, (bad ? 0.75 : 0.3) * tm)) {
    await wait(500);
    await say([bad ? pickNew(TAUNTS, "taunt", S, rng) : pickNew(DIGS, "dig", S, rng)]);
  }
  if (!over && bad && rng() < Math.min(0.9, 0.35 * tm)) {
    await wait(300);
    await say([pickNew(TAUNTS, "taunt", S, rng)]);
  }

  S.round++;
  if (S.round >= ROUNDS.length) return finale();
  await wait(1000);
  next();
}

// ---- 電話 ----
function callRound(): Promise<void> {
  return new Promise((resolve) => {
    const v = el("div", "veil");
    const card = el("div", "card call");
    const av = el("div", "av ring", BOSS.ini);
    av.style.background = BOSS.bg;
    card.append(av, el("h1", null, BOSS.name), el("p", null, `音声通話の着信（${hhmm(S.minute)}）`));
    const acts = el("div", "acts");
    const phone =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/></svg>';
    const mk = (cls: string, label: string) => {
      const w = el("label");
      const b = el("button", cls);
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.innerHTML = phone;
      w.append(b, document.createTextNode(label));
      acts.append(w);
      return b;
    };
    const no = mk("no", "拒否");
    const yes = mk("yes", "応答");
    card.append(acts);
    v.append(card);
    document.body.append(v);
    ping("call");
    const rep = window.setInterval(() => ping("call"), 2200);
    yes.focus();

    no.addEventListener("click", async () => {
      clearInterval(rep);
      v.remove();
      sys(`不在着信：${BOSS.name}（${hhmm(S.minute)}）`);
      applyFx({ trust: -14, hp: 0 });
      await wait(700);
      await say(REJECT, { newGroup: true, burst: true });
      resolve();
    });
    yes.addEventListener("click", async () => {
      clearInterval(rep);
      av.classList.remove("ring");
      acts.remove();
      const timer = el("p", "timer num", "通話中 00:00");
      const cap = el("div", "captions");
      card.append(timer, cap);
      let sec = 0;
      const tick = window.setInterval(() => {
        sec += 7;
        timer.textContent = `通話中 ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
      }, 250 * SPEED);
      for (const line of CALL_LINES) {
        await wait(1300);
        cap.append(el("p", null, `${BOSS.short}：${line}`));
      }
      await wait(1100);
      clearInterval(tick);
      v.remove();
      S.minute += 18;
      applyFx({ trust: 6, hp: -12 });
      sys(`通話が終了しました（${timer.textContent!.replace("通話中 ", "")}）`);
      resolve();
    });
  });
}

// ---- 進行 ----
async function next(): Promise<void> {
  if (over) return;
  const r = ROUNDS[S.round];
  S.minute = Math.max(S.minute, r.t);
  renderMeters(S);
  if (r.side) {
    toast(r.side, S.minute);
    await wait(1400);
  }
  if ("call" in r) {
    await callRound();
    if (S.hp <= 0) return ending("sleep");
    S.round++;
    await wait(900);
    return next();
  }
  if (S.round > 0 && !r.meet && rng() < 0.4) {
    await say(pickNew(INTERJECT.map((x) => x.join("\n")), "inter", S, rng).split("\n"), { newGroup: true, burst: true });
    await wait(700);
  }
  if (opt.diff === "hell" && S.round > 0 && rng() < 0.5) {
    toast(pick(STORMS, rng), S.minute);
    ping();
    S.grilled++;
    applyFx({ hp: -2 });
    await wait(1300);
    if (S.hp <= 0) return ending("sleep");
  }
  if (r.meet && r.intro) {
    sys(r.intro);
    await wait(900);
  }
  if (r.deadline) S.deadlineSaid = true;
  if (r.deleted) {
    typing(true);
    await wait(1800);
    typing(false);
    sys(`${BOSS.name} がメッセージを削除しました`);
    await wait(1200);
  }
  await say(r.msgs, { newGroup: true, burst: r.burst });
  if (r.note) {
    noteRow(r.note);
    await wait(1500);
  }
  if (r.pause) {
    typing(true);
    await wait(2600);
    typing(false);
    await wait(1400);
  }
  busy = false;
  nagRound = 0;
  chips(r.opts);
  if (r.meet) meetTimer(r);
}

async function finale(): Promise<void> {
  S.minute = Math.max(S.minute, 26 * 60);
  renderMeters(S);
  await wait(1200);
  const kind = decide(S);
  await say(FINAL_LINES[kind as Exclude<EndingKind, "sleep">], { newGroup: true });
  ending(kind);
}

async function ending(kind: EndingKind): Promise<void> {
  over = true;
  busy = true;
  clearTimeout(nagT);
  clearInterval(meetT);
  chips(null);
  typing(false);
  let night: string;
  const good = S.trust >= 80 && kind !== "sleep";
  if (kind === "sleep") {
    await wait(800);
    await say(SLEEP_LINES, { newGroup: true });
    S.minute = Math.max(S.minute, 28 * 60);
    renderMeters(S);
    night = SLEEP_LINES[SLEEP_LINES.length - 1];
  } else if (good) {
    night = GOOD_NIGHT;
    await say([night], { newGroup: true });
  } else {
    night = pick(SOFT_NIGHT, rng);
    await wait(900);
    await say([night], { newGroup: true });
  }
  await wait(1200);
  showResult(kind, night, good);
}

function showResult(kind: EndingKind, night: string, good: boolean): void {
  const e = ENDINGS[kind];
  const title = badge(kind, S);
  const sleepMin = Math.max(0, WAKE_MIN - S.minute);
  const tag = "パートナー版" + (D().label ? "・" + D().label : "") + (opt.len === "short" ? "・短め" : "");
  const v = el("div", "veil");
  const card = el("div", "card result");
  card.append(el("div", "big num", hhmm(S.minute)), el("p", "tag", tag), el("h1", null, e.h), el("p", "lead", e.p.replace("{gm}", String(S.gm))));

  const stats: [string, string][] = [
    ["詰められた回数", S.grilled + "回"],
    ["催促された回数", S.nag + "回"],
    ["寝られる時間", `${Math.floor(sleepMin / 60)}時間${sleepMin % 60}分`],
    ["粗利率", S.gm + "%"],
    ["チーム稼働", S.util + "%"],
    ["継続確度", CONT_LETTER[S.cont]],
  ];
  const st = el("div", "stats");
  for (const [k, val] of stats) {
    const d = el("div");
    d.append(el("small", null, k), el("b", "num", val));
    st.append(d);
  }
  card.append(st, el("span", "title-badge", "称号：" + title));

  const q = el("div", "quote");
  q.append(el("small", null, `その夜のチャット（${BOSS.short}）`), el("p", null, `「${night}」`));
  q.append(el("small", null, `3週間後の昇格会議（${BOSS.short}）`), el("p", null, `「${laterQuote(good, rng)}」`));
  card.append(q);

  const ap = aptitude(kind, S);
  const apb = el("div", "apt");
  apb.append(el("small", null, "コンサル適性"));
  for (const [k, n] of ap) {
    const row = el("div", "aptrow");
    row.append(el("span", null, k), el("b", "num", "●".repeat(n) + "○".repeat(5 - n)));
    apb.append(row);
  }
  card.append(apb);

  const top = ap.slice().sort((a, b) => b[1] - a[1])[0];
  const share = [
    `【深夜の収支レビュー ${tag}】${e.h}`,
    `詰められ${S.grilled}回・催促${S.nag}回`,
    `粗利率${S.gm}%・稼働${S.util}%・継続確度${CONT_LETTER[S.cont]}`,
    `称号：${title}`,
    `コンサル適性：${top[0]}★${top[1]}`,
  ].join("\n");

  const btns = el("div", "btns");
  const again = el("button", "go", "もう一度");
  again.type = "button";
  again.addEventListener("click", () => {
    v.remove();
    $("startVeil").hidden = false;
  });
  const copy = el("button", "ghost", "結果をコピー");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(share + "\n" + location.origin);
      copy.textContent = "コピーしました";
    } catch {
      copy.textContent = "コピーできませんでした";
    }
  });
  btns.append(again, copy);
  card.append(btns);
  v.append(card);
  document.body.append(v);
  again.focus();
}

// ---- 開始 ----
function history(): void {
  resetLog();
  day("今日");
  const b = bossRow("明日のレビューの前に、Orionの話を聞きたい", 21 * 60 + 40, true);
  b.after(
    (() => {
      const f = el("div", "file");
      f.innerHTML = '<div class="ic x">XLS</div><div><div class="nm">Orion_PJ収支_10月.xlsx</div><small>1.2 MB</small></div>';
      return f;
    })(),
  );
  myRow("承知しました。最新の収支表をお送りします", 21 * 60 + 52);
  sys(`${BOSS.name} が「連絡可能」になりました（22:28）`);
}

function start(): void {
  $("startVeil").hidden = true;
  S = fresh();
  over = false;
  busy = true;
  CHATS.forEach((c) => (c.unread = 0));
  CHATS[0].unread = 0;
  renderList();
  renderMeters(S);
  history();
  ROUNDS = buildNight(opt.len, rng);
  chips(null);
  setTimeout(() => next(), 1200 * SPEED);
}

function seg(id: string, key: "diff" | "len"): void {
  const box = $(id);
  box.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    (opt as Record<string, string>)[key] = b.dataset.v!;
  });
}

seg("diffSeg", "diff");
seg("lenSeg", "len");
$("startBtn").addEventListener("click", start);
$("soundBtn").addEventListener("click", () => {
  const on = toggleSound();
  $("soundBtn").textContent = on ? "通知音 ON" : "通知音 OFF";
  $("soundBtn").setAttribute("aria-pressed", String(on));
});
$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("msg") as HTMLInputElement;
  const v = input.value.trim();
  if (!v || busy) return;
  input.value = "";
  S.free++;
  answer(readFree(v, S, rng), v);
});

renderList();
renderMeters(S);
history();
chips(null);
