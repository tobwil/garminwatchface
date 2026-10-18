// SAGA — "Finos Reise": a serial story in 21 chapters. Fino the fox finds an old map and travels to
// the sea, with Pia the magpie, over a river, the mountains and through a village. Every good day
// unlocks the next chapter (one per day): the same day score as the garden (sleep score, steps
// against the goal, stress, Body Battery) has to reach 60. The new chapter is typed out on every
// wrist raise of its day while Fino walks into the scene; until the next one is unlocked, the face
// tells you how many steps are still missing. The progress lives in the watch's storage; after the
// last chapter a new journey begins. The scenes stand under the real sky and the real rain or snow.
// Styles: 1 Bilderbuch, 2 Nacht, 3 Gameboy. Mirrors watch/source/faces/Saga.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SE } from "../engine/season.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/saga.js";

const SP = encodeAll(S);
const GY = 290; // ground
const FX = 150; // where Fino stands
// per chapter: scene (0 forest, 1 meadow, 2 river, 3 mountains, 4 village, 5 cave, 6 sea), prop (0 none,
// 1 map, 3 bridge, 4 campfire, 5 owl, 6 boat on the beach, 7 lantern, 8 lighthouse, 9 sailing, 10 on top)
const SC = [0, 0, 0, 1, 1, 2, 2, 0, 0, 3, 3, 5, 5, 3, 4, 4, 1, 1, 6, 6, 6, 6];
const PR = [0, 1, 0, 0, 0, 0, 3, 4, 5, 0, 0, 7, 7, 0, 0, 0, 0, 4, 8, 6, 9, 10];
const TX = [
  "FINO TRÄUMT VOM MEER.", "HILF IHM: MACH AUS", "HEUTE EINEN GUTEN TAG!",
  "IM BAU FINDET FINO", "EINE ALTE KARTE.", "SIE ZEIGT DAS MEER!",
  "FINO PACKT SEINEN", "RUCKSACK UND ZIEHT", "DURCH DEN WALD.",
  "AUF DER WIESE TRIFFT", "ER PIA, DIE ELSTER.", "SIE KOMMT MIT.",
  "PIA FLIEGT VORAUS:", "DORT HINTEN GLITZERT", "EIN FLUSS!",
  "DER FLUSS IST BREIT.", "KEIN WEG HINÜBER.", "FINO DENKT NACH.",
  "DIE BIBER HABEN EINE", "BRÜCKE GEBAUT.", "DANKE, IHR BIBER!",
  "ABENDS KNISTERT DAS", "LAGERFEUER. PIA", "ERZÄHLT VOM MEER.",
  "EINE EULE WARNT:", "HINTER DEN BERGEN", "WIRD ES KALT.",
  "DIE BERGE SIND HOCH.", "SCHRITT FÜR SCHRITT", "GEHT ES BERGAUF.",
  "OBEN LIEGT SCHNEE.", "FINO FRIERT AN DEN", "PFOTEN UND LACHT.",
  "EIN STURM ZIEHT AUF.", "IN EINER HÖHLE", "FINDEN SIE SCHUTZ.",
  "IN DER HÖHLE", "LEUCHTEN KRISTALLE.", "FINO STAUNT.",
  "VOM GIPFEL SIEHT PIA", "EIN DORF IM TAL.", "DA GEHT'S LANG!",
  "IM DORF RIECHT ES", "NACH FRISCHEM BROT.", "FINO HAT HUNGER.",
  "DER BÄCKER SCHENKT", "IHM EINE BREZEL.", "DAS GIBT KRAFT!",
  "DIE LUFT WIRD SALZIG,", "MÖWEN KREISEN.", "ES IST NICHT WEIT.",
  "LETZTE NACHT UNTER", "DEN STERNEN. FINO", "KANN NICHT SCHLAFEN.",
  "DA IST ES: DAS MEER!", "SO GROSS UND BLAU", "WIE AUF DER KARTE.",
  "EIN ALTER FISCHER", "LEIHT IHNEN SEIN", "KLEINES BOOT.",
  "SIE SEGELN ZUM", "LEUCHTTURM. PIA", "SITZT AUF DEM MAST.",
  "OBEN AM LEUCHTTURM", "SCHAUT FINO ZURÜCK:", "WAS FÜR EINE REISE!",
];

let ss = null; // [chapter, unlocked today, journey], read with every static redraw

function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function dayKey(d) { return d.year * 1000 + d.doy; }
function yKey(d) { return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365); }
function goalOf(d) { return d.stepGoal > 0 ? d.stepGoal : 10000; }
// the day score without the steps: 0.3 sleep + 0.15 calm + 0.15 energy (+ 0.4 steps = 0..100)
function base(d) {
  const sl = d.sleep > 0 ? d.sleep : 60, ca = d.stress >= 0 ? 100 - d.stress : 60, en = d.bb >= 0 ? d.bb : 60;
  return 0.3 * sl + 0.15 * ca + 0.15 * en;
}
function score(d) { return Math.round(base(d) + 40 * G.clamp(d.steps / goalOf(d), 0, 1)); }

// persistent state: unlock today's chapter once the day is good enough
function sync(d) {
  // web preview only: seed a journey in progress once
  if (St.get("saDemo", 0) === 0) {
    St.set("saDemo", 1);
    St.set("saC", d.cfg.demoCh ?? 6);
    St.set("saR", 1);
    St.set("saD", yKey(d));
  }
  const today = dayKey(d);
  let c = St.get("saC", 0), r = St.get("saR", 1);
  if (St.get("saD", -1) !== today && score(d) >= 60) {
    if (c >= 21) { c = 1; r += 1; } else c += 1;
    St.set("saC", c);
    St.set("saR", r);
    St.set("saD", today);
  }
  return [c, St.get("saD", -1) === today ? 1 : 0, r];
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, text, text dim,
//  panel, fur, white, dark, star, trunk]
function pal(st, acc) {
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, e, c, a, b, e, a, e, a];
  }
  return [0x4a9ae8, 0xb8e0ff, 0x5a4a9a, 0xff9a6a, st === 2 ? 0x000000 : 0x060a20, st === 2 ? 0x060c1a : 0x141c44,
    0xffffff, acc, 0x0c1016, 0xf07a2a, 0xffffff, 0x2a1a14, 0xffffff, 0x5a3a24];
}

export default {
  fps: 10,

  // static layer: the sky, the chapter's scene and props, the text, the status and the chapter dots;
  // Fino, Pia, flames, the lantern's glow, rain or snow and the typewriter move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const tt = a.live ? a.t : 0;
    if (S || ss === null) ss = sync(d);
    const ch = ss[0], fresh = ss[1] === 1;
    const sc = SC[ch], pr = PR[ch];
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = st === 2 || el < -6 || ch === 17 ? 2 : el > 4 ? 0 : 1;
    const nf = st === 3 ? 0 : [0, 0.3, 0.6][k];
    const dk = (c) => G.mix(c, 0x050814, nf);
    const gb = st === 3;

    if (S) {
      // ---- sky (the cave has rock instead)
      if (sc === 5) {
        dc.setColor(gb ? 0x0f380f : 0x1a1612, -1);
        dc.fillRectangle(0, 0, 454, GY);
        dc.setColor(gb ? 0x306230 : 0x2a241e, -1);
        for (let i = 0; i < 9; i++) dc.fillRectangle(((i * 97) % 420), 90 + ((i * 41) % 160), 40 + (i % 3) * 20, 10);
        // glowing crystals
        for (let i = 0; i < 5; i++) {
          const x = 40 + i * 92, h = 24 + (i % 3) * 14;
          dc.setColor(gb ? 0x9bbc0f : i % 2 === 0 ? 0x5ae0ff : 0xc87aff, -1);
          dc.fillPolygon([[x, GY], [x + 8, GY - h], [x + 16, GY]]);
          dc.fillPolygon([[x + 12, GY], [x + 20, GY - h * 0.6], [x + 28, GY]]);
        }
      } else {
        for (let i = 0; i < 5; i++) {
          dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4), -1);
          dc.fillRectangle(0, i * 58, 454, 58);
        }
        if (k === 2) {
          dc.setColor(P[12], -1);
          for (let i = 0; i < 28; i++) dc.fillRectangle(20 + ((i * 101 + 17) % 414), 92 + ((i * 47 + 11) % 120), i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
        } else if (el > -4) {
          dc.setColor(gb ? 0x9bbc0f : 0xfff6d0, -1);
          dc.fillCircle(84, 250 - Math.round(G.clamp(el, -4, 40) * 3.6), 14);
        }
      }

      // ---- the scene
      const gnd = [0x3a6a2a, 0x5aa83a, 0x5aa83a, 0xe8eef6, 0x8aa85a, 0x2a2420, 0xe8d098][sc];
      if (sc === 0) {
        dc.setColor(dk(gb ? 0x306230 : 0x1e4a2a), -1);
        for (let i = 0; i < 9; i++) {
          const x = i * 56 - 20, h = 90 + ((i * 37) % 50);
          dc.fillPolygon([[x, GY], [x + 30, GY - h], [x + 60, GY]]);
        }
        dc.setColor(dk(gb ? 0x0f380f : 0x2a6a32), -1);
        for (let i = 0; i < 3; i++) {
          const x = [-30, 300, 380][i], h = [150, 130, 170][i];
          dc.fillPolygon([[x, GY - 20], [x + 40, GY - h], [x + 80, GY - 20]]);
        }
        dc.setColor(dk(P[13]), -1);
        for (let i = 0; i < 3; i++) dc.fillRectangle([-30, 300, 380][i] + 34, GY - 20, 12, 20);
      } else if (sc === 1 || sc === 4) {
        dc.setColor(dk(gb ? 0x306230 : 0x6ab84a), -1);
        for (let x = 0; x < 454; x += 8) {
          const h = 30 + Math.round(16 * Math.sin(x / 70 + 1) + 8 * Math.sin(x / 29));
          dc.fillRectangle(x, GY - h, 8, h);
        }
        if (sc === 4) {
          // the village
          for (let i = 0; i < 4; i++) {
            const x = [24, 110, 290, 372][i], w = 66, h = 54 + (i % 2) * 20;
            dc.setColor(dk(gb ? 0x8bac0f : [0xf0e0c0, 0xe8c8a0, 0xd8e0e8, 0xf0d8b0][i]), -1);
            dc.fillRectangle(x, GY - h, w, h);
            dc.setColor(dk(gb ? 0x0f380f : 0xb84a2a), -1);
            dc.fillPolygon([[x - 6, GY - h], [x + w / 2, GY - h - 30], [x + w + 6, GY - h]]);
            dc.setColor(k === 2 ? 0xffd27a : dk(gb ? 0x306230 : 0x3a5a8a), -1);
            dc.fillRectangle(x + 10, GY - h + 14, 14, 14);
            dc.fillRectangle(x + 40, GY - h + 14, 14, 14);
            dc.setColor(dk(gb ? 0x306230 : 0x6a3a24), -1);
            dc.fillRectangle(x + 26, GY - 26, 14, 26);
          }
        }
      } else if (sc === 3) {
        const M3 = [[-30, 200, 90], [110, 260, 110], [290, 200, 150]];
        for (const [x, w, top] of M3) {
          dc.setColor(dk(gb ? 0x306230 : 0x6a7488), -1);
          dc.fillPolygon([[x, GY], [x + w / 2, top], [x + w, GY]]);
          dc.setColor(dk(gb ? 0x9bbc0f : 0xf4f8ff), -1);
          dc.fillPolygon([[x + w / 2 - 22, top + 30], [x + w / 2, top], [x + w / 2 + 22, top + 30]]);
        }
      } else if (sc === 6) {
        dc.setColor(dk(gb ? 0x306230 : 0x2a6aa8), -1);
        dc.fillRectangle(0, 214, 454, GY - 214);
        dc.setColor(dk(gb ? 0x8bac0f : 0x8ac8f0), -1);
        for (let i = 0; i < 10; i++) dc.fillRectangle((i * 89) % 430, 222 + ((i * 23) % 60), 18, 2);
      }
      // ground (the river runs through a gap)
      dc.setColor(dk(gb ? 0x8bac0f : gnd), -1);
      if (sc === 2) {
        dc.fillRectangle(0, GY - 30, 180, 44);
        dc.fillRectangle(290, GY - 30, 164, 44);
        dc.setColor(dk(gb ? 0x306230 : 0x2a6aa8), -1);
        dc.fillRectangle(180, GY - 14, 110, 28);
        dc.setColor(dk(gb ? 0x9bbc0f : 0x8ac8f0), -1);
        for (let i = 0; i < 4; i++) dc.fillRectangle(190 + i * 24, GY - 8 + (i % 2) * 8, 14, 2);
      } else dc.fillRectangle(0, GY, 454, 14);
      if (sc === 1 && !gb) {
        for (let i = 0; i < 14; i++) {
          dc.setColor(dk([0xff5a8a, 0xffe05a, 0xffffff][i % 3]), -1);
          dc.fillRectangle(20 + ((i * 67) % 414), GY + 4 + ((i * 13) % 8), 4, 4);
        }
      }

      // ---- the props
      if (pr === 1) {
        dc.setColor(dk(gb ? 0x9bbc0f : 0xf0e0b0), -1);
        dc.fillRectangle(236, GY - 18, 40, 22);
        dc.setColor(dk(gb ? 0x0f380f : 0xd83a2a), -1);
        dc.fillRectangle(262, GY - 12, 4, 4);
        dc.fillRectangle(242, GY - 8, 14, 2);
      } else if (pr === 3) {
        dc.setColor(dk(gb ? 0x306230 : 0x8a5a2a), -1);
        dc.fillRectangle(170, GY - 34, 130, 8);
        for (let i = 0; i < 6; i++) dc.fillRectangle(172 + i * 24, GY - 52, 4, 20);
        dc.fillRectangle(170, GY - 52, 130, 4);
      } else if (pr === 4) {
        dc.setColor(dk(gb ? 0x0f380f : 0x5a3a1a), -1);
        dc.fillRectangle(272, GY - 6, 40, 6);
        dc.fillRectangle(280, GY - 10, 24, 4);
      } else if (pr === 5) {
        dc.setColor(dk(P[13]), -1);
        dc.fillRectangle(300, 176, 110, 8);
        SPR.draw(dc, SP.OWL, 350, 140, 4, [-1, dk(gb ? 0x306230 : 0x8a6a4a), dk(gb ? 0x8bac0f : 0xe8d8b8), gb ? 0x9bbc0f : 0xffd23a, 0x1a1a1a], false);
      } else if (pr === 7) {
        dc.setColor(gb ? 0x9bbc0f : 0x3a3a3a, -1);
        dc.fillRectangle(286, GY - 30, 16, 26);
        dc.setColor(gb ? 0x8bac0f : 0xffd27a, -1);
        dc.fillRectangle(290, GY - 24, 8, 14);
      } else if (pr === 6 || pr === 8 || pr === 10) {
        // the lighthouse (and the fisherman's boat on the beach)
        const lx = 372;
        for (let y = 110; y < GY; y += 4) {
          const hw = Math.round(G.lerp(10, 18, (y - 110) / (GY - 110)));
          dc.setColor(dk(gb ? (Math.floor((y - 110) / 30) % 2 ? 0x306230 : 0x9bbc0f) : Math.floor((y - 110) / 30) % 2 ? 0xd8302a : 0xf4f4f4), -1);
          dc.fillRectangle(lx - hw, y, 2 * hw, 4);
        }
        dc.setColor(dk(gb ? 0x0f380f : 0x2a2a30), -1);
        dc.fillRectangle(lx - 16, 106, 32, 6);
        dc.fillRectangle(lx - 8, 82, 16, 4);
        dc.setColor(k > 0 ? 0xffe08a : dk(0x2a3a48), -1);
        dc.fillRectangle(lx - 8, 86, 16, 20);
        if (pr === 6) {
          dc.setColor(dk(gb ? 0x306230 : 0x8a4a2a), -1);
          dc.fillPolygon([[220, GY - 18], [320, GY - 18], [306, GY], [234, GY]]);
          dc.setColor(dk(gb ? 0x0f380f : 0x5a3a24), -1);
          dc.fillRectangle(268, GY - 70, 4, 52);
        }
      }

      // ---- the chapter text, the status, the chapter dots
      dc.setColor(P[8], -1);
      dc.fillRectangle(0, GY + 14, 454, 150);
      dc.setColor(P[6], -1);
      for (let i = 0; i < 3; i++) F.px(dc, TX[ch * 3 + i], 227, GY + 22 + i * 20, 2, 1, 0);
      const need = Math.ceil(((60 - base(d)) / 40) * goalOf(d)) - d.steps;
      let msg;
      if (fresh) msg = ch === 21 ? "ENDE DER REISE!" : "MORGEN GEHT'S WEITER";
      else if (need > 0 && d.steps + need <= goalOf(d)) msg = "NOCH " + G.num(need) + " SCHRITTE";
      else msg = ch === 21 ? "EINE NEUE REISE WARTET" : "KAPITEL " + (ch + 1) + " WARTET";
      dc.setColor(P[7], -1);
      F.px(dc, msg, 227, 384, 2, 1, 0);
      for (let i = 0; i < 21; i++) {
        dc.setColor(i < ch ? (i === ch - 1 && fresh ? P[6] : P[7]) : G.mix(P[7], 0, 0.7), -1);
        dc.fillRectangle(124 + i * 10, 408, 6, 6);
      }

      // ---- time, chapter and date
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(gb ? 0x0f380f : P[6], -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, (ch === 0 ? "PROLOG" : "KAPITEL " + ch + "/21") + "   " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
    }

    if (!M) return;
    // ---- real rain or snow (not in the cave)
    if (sc !== 5) SE.precip(dc, d, 0, 90, 454, GY - 90, tt);
    // ---- the campfire and the lantern flicker
    if (pr === 4 || pr === 7) {
      const n = G.noise(tt / 140);
      dc.setColor(gb ? 0x9bbc0f : 0xff8a2a, -1);
      if (pr === 4) {
        dc.fillPolygon([[278, GY - 8], [292, GY - 40 - Math.round(n * 8)], [306, GY - 8]]);
        dc.setColor(gb ? 0x8bac0f : 0xffe05a, -1);
        dc.fillPolygon([[284, GY - 8], [292, GY - 26 - Math.round(n * 6)], [300, GY - 8]]);
      } else dc.fillRectangle(292, GY - 20 + Math.round(n * 2), 4, 6);
    }
    // ---- Fino: walks into a new chapter on its day, otherwise sits (in the boat, on the lighthouse)
    const walk = fresh && p < 0.85 && a.live;
    const fp = [-1, dk(gb ? 0x306230 : P[9]), dk(P[10]), P[11], dk(gb ? 0x0f380f : d.accent)];
    if (pr === 9) {
      const bob = Math.round(3 * Math.sin(tt / 400));
      const bx = Math.round(G.lerp(60, 200, G.ease(p)));
      dc.setColor(dk(gb ? 0x306230 : 0x8a4a2a), -1);
      dc.fillPolygon([[bx, GY - 30 + bob], [bx + 110, GY - 30 + bob], [bx + 96, GY - 10 + bob], [bx + 14, GY - 10 + bob]]);
      dc.setColor(dk(gb ? 0x0f380f : 0x5a3a24), -1);
      dc.fillRectangle(bx + 70, GY - 110 + bob, 4, 80);
      dc.setColor(dk(gb ? 0x9bbc0f : 0xf8f4e8), -1);
      dc.fillPolygon([[bx + 76, GY - 106 + bob], [bx + 76, GY - 38 + bob], [bx + 120, GY - 38 + bob]]);
      SPR.draw(dc, SP.FOX_SIT, bx + 10, GY - 74 + bob, 3, fp, false);
    } else if (pr === 10) {
      SPR.draw(dc, SP.FOX_SIT, 330, 82, 2, fp, false);
    } else {
      const fx = walk ? Math.round(G.lerp(-70, FX, p / 0.85)) : sc === 2 && pr !== 3 ? 90 : pr === 3 ? 196 : FX;
      const fy = sc === 2 ? GY - 82 + (pr === 3 ? 4 : 0) : GY - 48;
      SPR.draw(dc, walk ? (Math.floor(a.t / 140) % 2 ? SP.FOX_B : SP.FOX_A) : SP.FOX_SIT, fx, fy, 4, fp, false);
    }
    // ---- Pia the magpie travels along from chapter 3
    if (ch >= 3) {
      const up = Math.floor(tt / 160) % 2 === 0;
      const bx = pr === 9 ? 0 : FX + 90 + Math.round(30 * Math.sin(tt / 1100));
      const by = 170 + Math.round(14 * Math.sin(tt / 450));
      if (pr === 9) SPR.draw(dc, SP.BIRD_B, Math.round(G.lerp(60, 200, G.ease(p))) + 62, GY - 136 + Math.round(3 * Math.sin(tt / 400)), 3,
        [-1, gb ? 0x0f380f : 0x101418, gb ? 0x9bbc0f : 0xffffff, gb ? 0x306230 : 0x3a6ad8], false);
      else SPR.draw(dc, up ? SP.BIRD_A : SP.BIRD_B, bx, by, 3,
        [-1, gb ? 0x0f380f : 0x101418, gb ? 0x9bbc0f : 0xffffff, gb ? 0x306230 : 0x3a6ad8], false);
    }
    // ---- the typewriter: today's new chapter appears letter by letter
    if (fresh && a.live && p < 1) {
      let n = Math.floor(G.clamp(p / 0.9, 0, 1) * 66), cur = false;
      for (let i = 0; i < 3; i++) {
        const t = TX[ch * 3 + i], L = t.length, W = F.pxW(t, 2);
        const shown = G.clamp(n, 0, L);
        const x0 = Math.round(227 - W / 2);
        if (shown < L) {
          dc.setColor(P[8], -1);
          dc.fillRectangle(x0 + shown * 12, GY + 20 + i * 20, W - shown * 12 + 2, 18);
          if (!cur && n >= 0 && Math.floor(a.t / 200) % 2 === 0) {
            dc.setColor(P[7], -1);
            dc.fillRectangle(x0 + shown * 12, GY + 22 + i * 20, 10, 14);
          }
          cur = true;
        }
        n -= L;
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const ch = ss === null ? 0 : ss[0];
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    dc.setColor(st === 3 ? 0x306230 : 0x4a4a52, -1);
    F.px(dc, ch === 0 ? "PROLOG" : "KAPITEL " + ch + "/21", 227 + o[0], 384 + o[1], 2, 1, 0);
  },
};
