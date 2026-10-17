// AST — sun & moon maths (NOAA approximation). Mirrors watch/source/Astro.mc.
const RAD = Math.PI / 180;

export const AST = {
  // returns [eqtimeMinutes, declinationRad] for day-of-year and UTC hour
  _sun(doy, hourUtc) {
    const g = ((2 * Math.PI) / 365) * (doy - 1 + (hourUtc - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const de = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    return [eq, de];
  },

  // Sun elevation in degrees at local minute-of-day `min`. tz = UTC offset in minutes.
  elev(doy, min, lat, lon, tz) {
    const s = AST._sun(doy, (min - tz) / 60);
    const tst = min + s[0] + 4 * lon - tz;
    const ha = (tst / 4 - 180) * RAD;
    const la = lat * RAD;
    const cz = Math.sin(la) * Math.sin(s[1]) + Math.cos(la) * Math.cos(s[1]) * Math.cos(ha);
    return 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / RAD;
  },

  // Local minute-of-day when the sun crosses elevation `el` (deg). rising=true for morning.
  // Returns -1 if it never happens (polar day/night).
  cross(doy, lat, lon, tz, el, rising) {
    const s = AST._sun(doy, 12 - tz / 60);
    const la = lat * RAD;
    const c = (Math.sin(el * RAD) - Math.sin(la) * Math.sin(s[1])) / (Math.cos(la) * Math.cos(s[1]));
    if (c < -1 || c > 1) return -1;
    const ha = Math.acos(c) / RAD;
    const utc = 720 - 4 * (lon + (rising ? ha : -ha)) - s[0];
    return ((utc + tz) % 1440 + 1440) % 1440;
  },

  noon(doy, lon, tz) {
    const s = AST._sun(doy, 12 - tz / 60);
    return ((720 - 4 * lon - s[0] + tz) % 1440 + 1440) % 1440;
  },

  // Moon phase 0..1 (0 = new, 0.5 = full) from unix seconds.
  moon(unix) {
    const jd = unix / 86400 + 2440587.5;
    const age = (((jd - 2451550.1) % 29.530588853) + 29.530588853) % 29.530588853;
    return age / 29.530588853;
  },
  illum(phase) { return (1 - Math.cos(phase * 2 * Math.PI)) / 2; },
};
