// Körperscan sprite (face BODY): a front-facing human figure on a 22 x 44 grid, built from simple
// shapes; 1 fill, 2 outline (cells at the edge of the figure).
function figure() {
  const W = 22, H = 44, cx = 10.5;
  const inside = (c, r) => {
    const x = c + 0.5, y = r + 0.5;
    // head
    if (((x - (cx + 0.5)) / 3.7) ** 2 + ((y - 4.2) / 4.2) ** 2 <= 1) return true;
    // neck
    if (r >= 8 && r <= 10 && c >= 9 && c <= 12) return true;
    // torso: shoulders, waist, hips
    if (r >= 10 && r <= 25) {
      const hw = r < 11 ? 7.5 : r < 12 ? 9.5 : r < 18 ? 7 - (r - 12) * 0.34 : r < 22 ? 5 : 5.6;
      if (Math.abs(x - (cx + 0.5)) <= hw) return true;
    }
    // arms (joined at the shoulders), hands
    if (r >= 11 && r <= 27 && ((c >= 1 && c <= 2) || (c >= 19 && c <= 20))) return true;
    // legs and feet
    if (r >= 26 && r <= 41 && ((c >= 6 && c <= 9) || (c >= 12 && c <= 15))) return true;
    if (r >= 42 && r <= 43 && ((c >= 5 && c <= 9) || (c >= 12 && c <= 16))) return true;
    return false;
  };
  const rows = [];
  for (let r = 0; r < H; r++) {
    let s = "";
    for (let c = 0; c < W; c++) {
      if (!inside(c, r)) { s += "."; continue; }
      const edge = !inside(c - 1, r) || !inside(c + 1, r) || !inside(c, r - 1) || !inside(c, r + 1);
      s += edge ? "2" : "1";
    }
    rows.push(s);
  }
  return rows;
}

export default {
  FIGURE: { w: 22, h: 44, rows: figure() },
};
