// St — persistence + misc helpers for faces. Mirrors module St in watch/source/Face.mc.
// The studio swaps `St.store` per preview so faces can keep state (XP, streaks, ...).
import { G } from "./gfx.js";
import { F } from "./fonts.js";
import { Store } from "./model.js";

export const St = {
  store: new Store(),
  get(k, def) { return St.store.get(k, def); },
  set(k, v) { St.store.set(k, v); },
  // Burn-in protection: shift the AOD layout a few pixels each minute.
  shift(d) { const k = d.m % 9; return [((k % 3) - 1) * 4, (Math.floor(k / 3) - 1) * 4]; },
};

// Default always-on rendering (Face.aod in Face.mc)
export function defaultAod(dc, d) {
  const o = St.shift(d);
  dc.setColor(G.dim(d.accent, 0.55), -1);
  F.st(dc, G.timeStr(d), 227 + o[0], 227 + o[1], 64, 3, 1, 1.0, 0);
}
