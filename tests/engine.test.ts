import { describe, expect, it } from "vitest";
import { CLOSERS, DEADLINE, MEETS, OPENERS, POOL, SECRET, SPECIAL } from "../src/data/rounds";
import { decide } from "../src/engine/ending";
import { buildNight } from "../src/engine/night";
import { seeded } from "../src/engine/rand";
import { bare, hollow, readFree } from "../src/engine/read";
import { apply, fresh } from "../src/engine/state";
import type { Round } from "../src/types";

const all: Round[] = [...OPENERS, ...POOL, ...SPECIAL, SECRET, DEADLINE, ...MEETS, ...CLOSERS];

describe("data", () => {
  it("every round has 3 options with replies", () => {
    for (const r of all) {
      expect(r.opts, r.id).toHaveLength(3);
      for (const o of r.opts) expect(o.re.length, `${r.id}: ${o.text}`).toBeGreaterThan(0);
    }
  });
  it("round ids are unique", () => {
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });
  it("every round has a best option that raises trust", () => {
    for (const r of all) expect(Math.max(...r.opts.map((o) => o.fx.trust ?? 0)), r.id).toBeGreaterThan(0);
  });
  it("meet rounds have a miss option", () => {
    for (const r of MEETS) expect(r.opts.some((o) => o.miss)).toBe(true);
  });
});

describe("buildNight", () => {
  for (const len of ["normal", "short"] as const) {
    it(`keeps the arc (${len})`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const n = buildNight(len, seeded(seed));
        expect(n).toHaveLength(len === "short" ? 9 : 12);
        expect(OPENERS).toContain(OPENERS.find((o) => o.id === n[0].id));
        expect(CLOSERS.some((c) => c.id === n[n.length - 1].id)).toBe(true);
        const sp = n.findIndex((r) => "note" in r && r.note);
        const dl = n.findIndex((r) => r.id === "deadline");
        expect(sp).toBeGreaterThan(0);
        expect(dl).toBeGreaterThan(sp);
        expect(n.filter((r) => r.id === "call")).toHaveLength(1);
        expect(n.filter((r) => "meet" in r && r.meet)).toHaveLength(1);
        for (let i = 1; i < n.length; i++) expect(n[i].t).toBeGreaterThanOrEqual(n[i - 1].t - 6);
      }
    });
  }
});

describe("apply", () => {
  it("clamps and always drains a little mental", () => {
    const s = fresh();
    apply(s, { trust: 999 });
    expect(s.trust).toBe(100);
    expect(s.hp).toBe(99);
    apply(s, { trust: -999, gm: -999, util: -999, cont: -9 });
    expect([s.trust, s.gm, s.util, s.cont]).toEqual([0, 0, 80, 0]);
  });
  it("hell mode hurts more", () => {
    const a = fresh();
    const b = fresh();
    apply(a, { trust: -10, hp: -10 }, "normal");
    apply(b, { trust: -10, hp: -10 }, "hell");
    expect(b.trust).toBeLessThan(a.trust);
    expect(b.hp).toBeLessThan(a.hp);
  });
});

describe("readFree", () => {
  const r = (t: string, s = fresh()) => readFree(t, s, seeded(1));
  it("rewards numbers with deadlines", () => {
    expect(r("早瀬の稼働を今週中に20%下げます").fx.trust).toBeLessThan(0); // 早瀬（稼働）が先に当たる
    expect(r("水曜までに骨子を3枚で出します").fx.trust).toBeGreaterThan(0);
  });
  it("punishes 'ganbaru' before numbers", () => {
    expect(r("頑張って30%に戻します").fx.trust).toBe(-12);
  });
  it("detects hollow keywords", () => {
    expect(hollow("結論から言うと頑張ります")).toBe(true);
    expect(hollow("結論、定例を3つに絞ります")).toBe(false);
    expect(bare("結論")).toBe(true);
  });
  it("patches the keyword-only trick", () => {
    const s = fresh();
    expect(r("結論", s).patch).toBe(true);
    expect(r("結論", s).patch).toBe(false);
  });
  it("counts apologies anywhere", () => {
    expect(r("失礼しました、3日で直します").fx.sorry).toBe(1);
  });
  it("eggs win over rules", () => {
    expect(r("🐱").egg).toBe(true);
  });
  it("does not repeat the same first reply", () => {
    const s = fresh();
    const a = r("承知しました", s).re[0];
    const b = r("承知です", s).re[0];
    expect(a).not.toBe(b);
  });
});

describe("decide", () => {
  it("orders endings", () => {
    expect(decide({ ...fresh(), trust: 85, cont: 3 })).toBe("renew");
    expect(decide({ ...fresh(), trust: 85, cont: 2 })).toBe("monday");
    expect(decide({ ...fresh(), trust: 20 })).toBe("swap");
    expect(decide({ ...fresh(), gm: 18 })).toBe("red");
  });
});
