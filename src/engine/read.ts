import type { Fx, Reply, Rng, State } from "../types";
import { pickNew } from "./rand";

// 自由入力の読み取り。上から順に見て、最初に当たったものを返す。
// 順番がそのまま黒崎の性格：数字より先に「頑張る」や「先方のせい」に反応する。

interface Rule {
  re: RegExp;
  raw?: boolean; // 空白を消す前の文字列で見る
  fx: Fx | ((s: State) => Fx);
  say: string[] | ((s: State) => string[]);
}

// 隠し反応（どの判定より先）
const EGGS: Rule[] = [
  { re: /うんち|うんこ|💩/, fx: { trust: -6, hp: -2 }, say: ["…", "それ、議事録に残る前提で打ってる？"] },
  {
    re: /ねこ|猫|🐱|🐈|いぬ|犬|🐶|🐕|ペンギン|🐧|カピバラ|（・|\(・|｀|´/,
    fx: { trust: 3, hp: 2 },
    say: ["…かわいいね", "粗利はかわいくないけど"],
  },
  { re: /^(草|笑|ｗ|w|🤣|😂|（笑）|\(笑\))+[。！!]*$/i, fx: { trust: -4, hp: -2 }, say: ["楽しそうだね", "数字も楽しくして"] },
  { re: /^[\p{Extended_Pictographic}‍️\s]+$/u, fx: { trust: -6, hp: -2 }, say: ["絵文字で返すM、初めて見た"] },
  { re: /LGTM|ＬＧＴＭ/i, fx: { trust: -6, hp: -2 }, say: ["レビューされてるのは、桐生のほう"] },
  { re: /辞表|退職届|退職代行/, fx: { trust: -4, hp: 2 }, say: ["受け取るのは、収支表が先"] },
];

const RULES: Rule[] = [
  {
    re: /パワハラ|ハラスメント|労基|人事に/,
    fx: { trust: -12, hp: -4 },
    say: ["これは指導", "その話は、粗利を戻してからにしよう"],
  },
  {
    re: /28時|２８時/,
    fx: (s) => (s.deadlineSaid ? { trust: 4, hp: -6 } : { trust: -2, hp: -6 }),
    say: (s) => (s.deadlineSaid ? ["そう。火曜の28時"] : ["28時の話は、まだしてない", "…けど、その覚悟はいい"]),
  },
  {
    re: /24時間|２４時間|1日は|１日は|火曜は|終わる/,
    fx: { trust: -8, hp: -6 },
    say: ["Orionの赤字が終わってないんだから、火曜も終わらない"],
  },
  {
    re: /辞め|転職/,
    fx: { trust: -10, hp: 2 },
    say: ["辞めるのは自由", "案件は置いていって", "次の会社でも、同じ説明をするんだろうね"],
  },
  { re: /頑張|がんば/, fx: { trust: -12, hp: -4 }, say: ["『頑張る』は打ち手じゃない", "数字で言って"] },
  { re: /インターン/, fx: { trust: -6, hp: -6 }, say: ["自覚はあるんだ", "今夜中に卒業しよう"] },
  {
    re: /値引|ディスカウント|サービス/,
    fx: { trust: -10, hp: -6, gm: -1 },
    say: ["値引きはパートナーが決める", "勝手に配らないで"],
  },
  {
    re: /予算|コスト|赤字|粗利|収支|利益|マージン/,
    fx: { trust: -2, hp: -6 },
    say: ["で、何ポイント戻すの？", "%で言って。感想は要らない"],
  },
  {
    re: /稼働|残業|メンバー|早瀬|荻原|水野|アナリスト/,
    fx: { trust: -2, hp: -6 },
    say: ["チームを潰すMに、次の案件は任せられない", "どう下げるか、今言って"],
  },
  { re: /提案|次のフェーズ|次フェーズ/, fx: { trust: 0, hp: -6 }, say: ["出すかどうかじゃない。いつ取るか"] },
  { re: /継続|確度/, fx: { trust: -2, hp: -6 }, say: ["確度の根拠を3つ。今"] },
  {
    re: /森田|先方|クライアント|常務|高槻/,
    fx: { trust: -6, hp: -6 },
    say: ["クライアントのせいにするのは、いちばん安い", "安い説明で、月6,000万は取れない"],
  },
  { re: /^(承知|了解|かしこまり)/, fx: { trust: -4, hp: -4 }, say: ["何を承知したの？", "やることを1行で"] },
  { re: /^はい[。！!]?$/, fx: { trust: -6, hp: -4 }, say: ["『はい』じゃなくて数字", "返事だけは新卒より元気だね"] },
  {
    re: /無理|できません/,
    fx: { trust: -10, hp: 2 },
    say: ["できない理由は要らない", "できる条件を言って"],
  },
  {
    re: /すみません|すいません|申し訳|ごめん/,
    fx: { trust: -6, hp: -6, sorry: 1 },
    say: ["謝っても粗利は戻らない", "謝罪に何時間かけるの？"],
  },
  {
    re: /寝/,
    fx: { trust: -10, hp: 4 },
    say: ["寝る前に、明日の定例のアジェンダを送って", "寝られると思ってるところが甘い"],
  },
  {
    re: /\d+\s*(%|％|万|億|時間|分|時|本|人|枚)|までに/,
    raw: true,
    fx: { trust: 6, hp: -6, gm: 1 },
    say: ["その数字、明日のレビューでも言えるね？", "言えなかったら、二度と数字を口にしないで"],
  },
  { re: /確認/, fx: { trust: -4, hp: -4 }, say: ["確認は作業。判断して", "Mの給料は、判断に払ってる"] },
  { re: /[?？]$/, fx: { trust: -8, hp: -4 }, say: ["質問で返さない", "今は桐生が答える番"] },
  { re: /示唆|結論|なぜなら|つまり|So ?what/i, raw: true, fx: { trust: 8, hp: -4 }, say: ["それ。最初からそう言って"] },
];

const FALLBACK_1 = ["で？", "つまり？", "数字は？", "それで？", "主語は？", "何ポイント？"];
const FALLBACK_2 = ["結論から", "%で言って", "いつまでに、誰が、いくら", "感想は要らない"];

export const VOICE = {
  quitHigh: ["…そう", "桐生がいないと困る。それだけは言っておく"],
  quitLow: ["止めない", "引き継ぎ資料は、収支表から"],
  kwOnly: ["『結論』って言葉を使えば結論になるわけじゃない", "数字と、やることと、期限"],
  kwAgain: ["また中身のない『結論』", "言葉で飾るのは、新卒の資料と同じ"],
  waza: [
    ["『結論』とだけ送ってくるの、新しいね", "で、中身は？"],
    ["その手はもう効かない", "数字"],
  ],
  again: ["それ、さっきも言った", "同じことを2回言わせないで", "聞いてた？"],
};

// 「結論」などの言葉はあるが、中身（数字と行動と10字以上）がない
export function hollow(text: string): boolean {
  if (!/結論|アンサー|示唆|So ?what|つまり|要するに|イシュー/i.test(text)) return false;
  const num = /[0-9０-９]|[一二三四五六七八九十百千万億]+(つ|本|枚|割|億|万|%|％|か月|週|時|分)/.test(text);
  const act = /べき|やる|やめ|絞|削|下げ|上げ|減ら|増や|止め|出し|直し|送り|決め|します|です/.test(text);
  return !(num && act && text.replace(/\s/g, "").length >= 10);
}

// 「結論」「つまり」などの言葉だけ
export function bare(text: string): boolean {
  const t = text.replace(/[\s。、．，,.!！?？…・〜~「」『』()（）:：]/g, "");
  return /^(結論|アンサー|answer|示唆|sowhat|つまり|要するに|イシュー|結論から(言うと|いうと|申し上げますと)?)+(です|は)?$/i.test(t);
}

const APOLOGY = /すみません|すいません|申し訳|ごめん|失礼しました|お詫び|反省|面目/;

function run(rule: Rule, s: State): Reply {
  return {
    fx: typeof rule.fx === "function" ? rule.fx(s) : rule.fx,
    re: typeof rule.say === "function" ? rule.say(s) : rule.say,
  };
}

export function readFree(text: string, s: State, rng: Rng): Reply {
  const t = text.replace(/\s/g, "");
  let r: Reply | null = null;

  const egg = EGGS.find((e) => e.re.test(text));
  if (egg) {
    r = { ...run(egg, s), egg: true };
    s.egg++;
  }
  // 「辞めます」：返事で今の評価がばれる
  if (!r && /辞め(ます|たい|る|させ)|退職(します|したい|させ)|降ります|降りたい/.test(text)) {
    const hi = s.trust >= 60;
    r = { fx: { trust: hi ? 0 : -4, hp: hi ? -2 : -6 }, re: hi ? VOICE.quitHigh : VOICE.quitLow, egg: true };
  }
  // 言葉だけを送る技、または中身のない「結論」が3回目以降
  if (!r && (bare(text) || (s.kw >= 2 && hollow(text)))) {
    r = { fx: { trust: -10, hp: -4 }, re: VOICE.waza[s.waza ? 1 : 0], patch: s.waza === 0 };
    s.waza++;
    s.kw++;
  }
  if (!r && hollow(text)) {
    r = { fx: { trust: s.kw ? -8 : -6, hp: -4 }, re: s.kw ? VOICE.kwAgain : VOICE.kwOnly };
    s.kw++;
  }
  if (!r) {
    const rule = RULES.find((x) => x.re.test(x.raw ? text : t));
    r = rule
      ? run(rule, s)
      : {
          fx: { trust: -6, hp: -4 },
          re: [pickNew(FALLBACK_1, "fb1", s, rng), pickNew(FALLBACK_2, "fb2", s, rng)],
        };
  }

  const fx = { ...r.fx };
  if (APOLOGY.test(text) && !fx.sorry) fx.sorry = 1;
  let re = r.re.slice();
  // 同じ返しは繰り返さない（隠し反応と技の1〜2回目は除く）
  if (!r.egg && !(r.patch !== undefined && s.waza <= 2) && s.usedRe.includes(re[0])) {
    re = [pickNew(VOICE.again, "again", s, rng), ...(re.length > 1 ? [re[re.length - 1]] : [])];
  }
  s.usedRe.push(re[0]);
  return { fx, re, egg: r.egg, patch: r.patch };
}
