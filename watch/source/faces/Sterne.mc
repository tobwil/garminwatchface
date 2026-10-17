import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// STERNE — "Sternenhimmel": the real sky above the user's location, now. ~150 bright stars,
// constellation figures, the Milky Way, the Moon at its real position and phase and the Sun,
// in a zenith-centred stereographic all-sky projection (north up, east left — as seen lying on
// your back). Star positions follow the local sidereal time (computed once per minute).
// Daytime: blue/twilight dome with the sun, stars only faint. Each wrist raise may bring a
// shooting star. Styles: 1 Planetarium, 2 Sternkarte (printed chart), 3 Polarlicht (panorama
// to the north: aurora over a forest lake). Mirrors web/js/faces/sterne.js.
class FaceSterne extends Face {
    const RAD = 0.017453292519943295;
    const CX = 227;
    // stars: ra*40 << 20 | (dec+90)*10 << 9 | (mag+2)*10 << 2 | colour (0 blue-white, 1 white, 2 yellow-orange, 3 red)
    const ST = [
        464247962, 463171760, 499858096, 514555092, 541812888, 562778796, 579527324, 106824353, 735956224, 704475386,
        660413692, 623695014, 644654280, 684520729, 7055533, 29061802, 40617640, 60538044, 80478936, 868913792,
        855256745, 818493642, 872001718, 829066948, 781848656, 787085564, 790209756, 796497616, 793373439, 833075825,
        829938878, 836208870, 815220441, 801644232, 801547992, 249011299, 220619860, 228034704, 232194728, 235335828,
        238477976, 243680932, 234344152, 193483378, 229196944, 236498632, 181944546, 188254430, 159967940, 318342800,
        325662846, 278417564, 267963079, 282656458, 307806429, 283490836, 292865164, 300218522, 267755680, 310689456,
        321351773, 312979140, 426244232, 496512164, 433624230, 471376568, 471350484, 425220316, 410576074, 414781678,
        431545561, 598247506, 619259570, 609879753, 630862046, 640262878, 583563454, 563488888, 675642552, 671433900,
        670367428, 692385919, 696571072, 705977006, 708055240, 709081314, 721660117, 739486877, 742653104, 736371344,
        772036760, 794098336, 799322808, 769963198, 775228610, 786754768, 759474378, 802479830, 968374452, 968440499,
        9976000, 6901412, 911724210, 952623320, 27882198, 48877731, 87709350, 143322777, 131742884, 129709766,
        156943560, 167389380, 164202176, 221945942, 252349596, 252309688, 208249022, 652836084, 649678565, 653860520,
        659101416, 664343306, 669590262, 701071554, 702157534, 724166867, 713650924, 692631234, 753602219, 734731970,
        751532778, 735795476, 806113998, 720120528, 688641726, 647734486, 591139040, 522328688, 537026176, 525505171,
        513962176, 737674404, 962902144, 30777506, 89710242, 80259256, 396778146, 68325476, 268626485, 614615110,
        590499944
    ];
    // constellation figure lines: star a << 8 | star b
    const LN = [
        1, 258, 515, 768, 772, 1029, 1286, 1800, 2057, 2314,
        2571, 2828, 3085, 3338, 3599, 3856, 4113, 4370, 4884, 5141,
        5908, 5142, 6169, 6426, 6683, 6940, 7193, 7709, 7455, 7456,
        8226, 8225, 10787, 10789, 9000, 9510, 9767, 10024, 10281, 9764,
        11823, 12076, 11819, 11053, 12594, 12597, 13620, 12854, 13875, 14903,
        14137, 14648, 14651, 15421, 15939, 17216, 16454, 17989, 17732, 16449,
        16703, 16194, 16958, 16706, 18248, 18507, 19274, 19017, 18759, 18252,
        20047, 20304, 20305, 20818, 21075, 21332, 21589, 21846, 22103, 22360,
        22617, 24666, 23133, 23904, 23902, 24159, 24413, 24411, 23393, 24924,
        23647, 23642, 25187, 25445, 25956, 25698, 25191, 26470, 25960, 26729,
        26986, 28011, 27502, 28271, 28528, 27500, 29042, 29299, 29484, 11380,
        29809, 30070, 30327, 30584, 30841, 31098, 31612, 31869, 32126, 32379,
        31615, 32897, 33155, 33666, 33408, 33412, 33925, 34182, 34439, 34696,
        35211, 35468, 37009, 38294
    ];
    // Milky Way: galactic equator every 10° (ra*40 << 20 | (dec+90)*10 << 9 | brightness 0..100)
    const MW = [
        744801885, 760574561, 774251107, 787928164, 800556643, 814233185, 827909725, 844730455, 864695888, 889900617,
        923489344, 968604727, 18607661, 79421485, 131831341, 171647021, 200970285, 223998509, 241781293, 257465901,
        271052333, 284638253, 297175597, 310762029, 324348461, 341082157, 360962605, 386089517, 419609645, 464671789,
        521282093, 582103095, 634550848, 674426953, 703823952, 726933079
    ];
    // constellation names (label order = priority) and [first star, count]
    const CN = ["Gr. Wagen", "Polarstern", "Kassiopeia", "Schwan", "Leier", "Adler", "Orion", "Stier", "Zwillinge", "Gr. Hund",
        "", "Löwe", "Bärenhüter", "", "Skorpion", "Schütze", "Pegasus", "Andromeda", "Perseus", "Fuhrmann", "Krone",
        "Herkules", "Drache", "Kreuz"];
    const STAR_COL = [0xCFE0FF, 0xFFFFFF, 0xFFE0A8, 0xFFA486];
    const AUC = [0x86FFC0, 0x3EE69A, 0x179A78, 0x6A40C0];
    const AUA = [1.0, 0.86, 0.62, 0.46];
    const INK = 0x1B2238;
    const PAPER = 0xECE3CB;
    // style 3 panorama: looking north, view centre 15° above the horizon
    const SH3 = 0.258819;
    const CH3 = 0.9659258;
    const K3 = 300;
    const CY3 = 255;
    const NA = 36;      // aurora rays
    const NT = 30;      // far shore trees
    const CHUNK = 40;   // stars re-projected per frame (rolling update, see sky())
    const CS = [
        0, 7, 7, 7, 14, 5, 19, 5, 24, 5,
        29, 6, 35, 8, 43, 6, 49, 6, 55, 5,
        60, 2, 62, 9, 71, 6, 77, 1, 78, 12,
        90, 8, 98, 6, 104, 3, 107, 6, 113, 4,
        117, 6, 123, 5, 128, 9, 137, 4
    ];

    // ---- catalogue, decoded once: magnitude, sin/cos declination
    hidden var _mag as Array;
    hidden var _sde as Array;
    hidden var _cde as Array;
    // ---- sky state. Star positions are re-projected in rolling chunks of CHUNK stars per frame
    // whenever the minute (or style) changes, so no single frame does the whole catalogue.
    hidden var _kc = -1;
    hidden var _kd = -1;
    hidden var _ptr = 0;
    hidden var _cnt = 0;
    hidden var _c0 = 0;
    hidden var _cl = 0;
    hidden var _lst = 0.0;
    hidden var _sx as Array;
    hidden var _sy as Array;
    hidden var _su as Array;
    hidden var _wx as Array;
    hidden var _wy as Array;
    hidden var _wu as Array;
    hidden var _sunX = 0.0;
    hidden var _sunY = 0.0;
    hidden var _sunU = 0.0;
    hidden var _moX = 0.0;
    hidden var _moY = 0.0;
    hidden var _moU = 0.0;
    hidden var _el = 0.0;
    // ---- paint state: star palette (4 colour classes x 16 levels on the sky colour), per-star
    // palette index + brightness, Milky Way colours, constellation labels
    hidden var _spal as Array;
    hidden var _spb = -1;
    hidden var _sci as Array;
    hidden var _sff as Array;
    hidden var _mwc as Array;
    hidden var _lk = -2;
    hidden var _nlb = 0;
    hidden var _lbx = [0, 0, 0] as Array;
    hidden var _lby = [0, 0, 0] as Array;
    hidden var _lbw = [0, 0, 0] as Array;
    hidden var _lbi = [0, 0, 0] as Array;
    // per-frame (intro-animated) positions
    hidden var _rx as Array;
    hidden var _ry as Array;
    // style 3 static geometry (built once)
    hidden var _hz = null;
    hidden var _abx = null;
    hidden var _aby = null;
    hidden var _aux = null;
    hidden var _auy = null;
    hidden var _arh = null;
    hidden var _as = null;
    hidden var _af = null;
    hidden var _trx = null;
    hidden var _trb = null;
    hidden var _trw = null;
    hidden var _trh = null;
    hidden var _ap as Array;
    hidden var _apk = -1.0;
    hidden var _apb = -1;
    // reusable polygon buffers
    hidden var _lake = null;
    hidden var _tri = null;
    hidden var _pb = null;
    hidden var _fps = 8;
    hidden var _px = 0.0;
    hidden var _py = 0.0;
    hidden var _pu = 0.0;
    hidden var _sp = 0.0;
    hidden var _cp = 1.0;

    function initialize() {
        Face.initialize();
        var ns = ST.size();
        var nm = MW.size();
        _mag = new [ns];
        _sde = new [ns];
        _cde = new [ns];
        _sx = new [ns];
        _sy = new [ns];
        _su = new [ns];
        _rx = new [ns];
        _ry = new [ns];
        _sci = new [ns];
        _sff = new [ns];
        for (var i = 0; i < ns; i++) {
            var v = ST[i];
            _mag[i] = ((v >> 2) & 127) / 10.0 - 2;
            var de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
            _sde[i] = Math.sin(de);
            _cde[i] = Math.cos(de);
            _sx[i] = 0.0; _sy[i] = 0.0; _su[i] = -1.0; _rx[i] = 0.0; _ry[i] = 0.0; _sci[i] = -1; _sff[i] = 0.0;
        }
        _wx = new [nm];
        _wy = new [nm];
        _wu = new [nm];
        _mwc = new [nm * 2];
        for (var i = 0; i < nm; i++) {
            _wx[i] = 0.0; _wy[i] = 0.0; _wu[i] = 0.0; _mwc[i] = 0; _mwc[nm + i] = 0;
        }
        _spal = new [64];
        _ap = new [64];
    }

    function fps() as Number {
        return _fps;
    }

    hidden function wrap(v) {
        return v - 360 * Math.floor(v / 360.0);
    }

    // local horizontal unit vector (east, north, up) -> screen _px, _py for the style's projection
    hidden function projV(e, n, u, st, R) as Void {
        _pu = u;
        if (st == 3) {
            var dd = n * CH3 + u * SH3;
            var k = K3 / (dd > -0.9 ? 1 + dd : 0.1);
            _px = CX + k * e;
            _py = CY3 - k * (u * CH3 - n * SH3);
        } else {
            // zenith-centred stereographic all-sky map, north up, east left
            var k = R / (u > -0.95 ? 1 + u : 0.05);
            _px = CX - k * e;
            _py = CX - k * n;
        }
    }

    // hour angle h (deg) / sin, cos of the declination
    hidden function proj(h, sd, cd, st, R) as Void {
        var sh = Math.sin(h * RAD);
        var ch = Math.cos(h * RAD);
        projV(-cd * sh, _cp * sd - _sp * cd * ch, _sp * sd + _cp * cd * ch, st, R);
    }

    // azimuth / altitude (degrees)
    hidden function projA(az, alt, st, R) as Void {
        var ca = Math.cos(alt * RAD);
        projV(ca * Math.sin(az * RAD), ca * Math.cos(az * RAD), Math.sin(alt * RAD), st, R);
    }

    // ecliptic longitude/latitude (deg) at local sidereal time lst
    hidden function projEcl(lam, bet, lst, st, R) as Void {
        var ep = 23.439 * RAD;
        var sl = Math.sin(lam * RAD);
        var cl = Math.cos(lam * RAD);
        var sb = Math.sin(bet * RAD);
        var cb = Math.cos(bet * RAD);
        var ra = Math.atan2(sl * Math.cos(ep) - (sb / cb) * Math.sin(ep), cl) / RAD;
        var de = Math.asin(sb * Math.cos(ep) + cb * Math.sin(ep) * sl);
        proj(lst - ra, Math.sin(de), Math.cos(de), st, R);
    }

    hidden function radius(st) as Number {
        return st == 2 ? 192 : 196;
    }

    // Sky for the current minute: sun, moon and Milky Way at once, the stars in rolling chunks
    // (all of them when `all`). _c0/_cl = the stars re-projected in this call.
    hidden function sky(d as D, st, all) as Void {
        var R = radius(st);
        var key = ((d.year % 10) * 400 + d.doy) * 5760 + d.mins * 4 + st;
        var ns = ST.size();
        _cl = 0;
        if (key != _kc) {
            if (_kc == -1 || (_kc & 3) != (key & 3)) {
                all = true;
            }
            _kc = key;
            _cnt = 0;
            var lat = d.locOk ? d.lat : 52.52;
            var lon = d.locOk ? d.lon : 13.4;
            _sp = Math.sin(lat * RAD);
            _cp = Math.cos(lat * RAD);
            var sec = d.unix - 946728000;
            var nd = sec / 86400;
            if (sec < 0 && nd * 86400 != sec) {
                nd -= 1;
            }
            var fr = (sec - nd * 86400) / 86400.0;
            _lst = wrap(280.46061837 + 0.98564736629 * nd + 360.98564736629 * fr + lon);
            var nm = MW.size();
            for (var i = 0; i < nm; i++) {
                var v = MW[i];
                var de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
                proj(_lst - (v >> 20) * 0.375, Math.sin(de), Math.cos(de), st, R);
                _wx[i] = _px; _wy[i] = _py; _wu[i] = _pu;
            }
            var n = nd + fr;
            // sun (low precision ephemeris)
            var g = wrap(357.528 + 0.9856003 * n);
            var ls = wrap(280.46 + 0.9856474 * n) + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
            projEcl(ls, 0, _lst, st, R);
            _sunX = _px; _sunY = _py; _sunU = _pu;
            _el = Math.asin(G.clamp(_pu, -1.0, 1.0)) / RAD;
            // moon (main periodic terms)
            var l0 = wrap(218.316 + 13.176396 * n);
            var mm = wrap(134.963 + 13.064993 * n);
            var ff = wrap(93.272 + 13.22935 * n);
            projEcl(l0 + 6.289 * Math.sin(mm * RAD), 5.128 * Math.sin(ff * RAD), _lst, st, R);
            _moX = _px; _moY = _py; _moU = _pu;
        }
        if (_cnt >= ns) {
            return;
        }
        var cnt = all ? ns - _cnt : (ns - _cnt < CHUNK ? ns - _cnt : CHUNK);
        _c0 = _ptr;
        _cl = cnt;
        var lst = _lst;
        var sp = _sp;
        var cp = _cp;
        for (var k = 0; k < cnt; k++) {
            var i = _ptr;
            var h = (lst - (ST[i] >> 20) * 0.375) * RAD;
            var sh = Math.sin(h);
            var ch = Math.cos(h);
            var sd = _sde[i];
            var cd = _cde[i];
            var e = -cd * sh;
            var n = cp * sd - sp * cd * ch;
            var u = sp * sd + cp * cd * ch;
            if (st == 3) {
                var dd = n * CH3 + u * SH3;
                var kk = K3 / (dd > -0.9 ? 1 + dd : 0.1);
                _sx[i] = CX + kk * e;
                _sy[i] = CY3 - kk * (u * CH3 - n * SH3);
            } else {
                var kk = R / (u > -0.95 ? 1 + u : 0.05);
                _sx[i] = CX - kk * e;
                _sy[i] = CX - kk * n;
            }
            _su[i] = u;
            _ptr = _ptr + 1 >= ns ? 0 : _ptr + 1;
        }
        _cnt += cnt;
        if (_cnt >= ns) {
            _kd = _kc;
        }
    }

    hidden function hy(x) {
        var f = G.clamp(x / 8.0, 0.0, 56.99);
        var j = Math.floor(f).toNumber();
        return _hz[j] + (_hz[j + 1] - _hz[j]) * (f - j);
    }

    // style 3: horizon table, aurora ray geometry and far trees (static, built once)
    hidden function panoInit() as Void {
        if (_hz != null) {
            return;
        }
        var hz = new [58];
        // horizon (alt 0) point for screen x: solve K3 sin a - X CH3 cos a = X for the azimuth a
        for (var j = 0; j < 58; j++) {
            var X = j * 8 - CX;
            var rr = Math.sqrt(K3 * K3 + X * X * CH3 * CH3);
            var az = Math.atan2(X * CH3, K3) + Math.asin(G.clamp(X / rr, -1.0, 1.0));
            var k = K3 / (1 + Math.cos(az) * CH3);
            hz[j] = CY3 + k * Math.cos(az) * SH3;
        }
        _hz = hz;
        _abx = new [NA];
        _aby = new [NA];
        _aux = new [NA];
        _auy = new [NA];
        _arh = new [NA];
        _as = new [NA];
        _af = new [NA];
        for (var i = 0; i < NA; i++) {
            var az = -77 + i * 4.4;
            projA(az, 4, 3, 0);
            _abx[i] = _px; _aby[i] = _py;
            projA(az, 14, 3, 0);
            _aux[i] = (_px - _abx[i]) / 10.0;
            _auy[i] = (_py - _aby[i]) / 10.0;
            _arh[i] = 2 * hy(_abx[i]);
            _as[i] = 0.0;
            _af[i] = 0.0;
        }
        _trx = new [NT];
        _trb = new [NT];
        _trw = new [NT];
        _trh = new [NT];
        var s = 4242;
        for (var i = 0; i < NT; i++) {
            s = G.rnd(s);
            var x = 4 + i * 15.2 + (s % 7);
            _trx[i] = x;
            _trh[i] = 12 + (s % 24) + ((x - CX).abs() > 150 ? 8 : 0);
            _trw[i] = 6 + (s % 3);
            _trb[i] = hy(x) + 1;
        }
        _lake = new [32];
        for (var j = 0; j < 32; j++) {
            _lake[j] = [0, 0];
        }
        _tri = [[0, 0], [0, 0], [0, 0]];
        _pb = new [29];
        for (var j = 0; j < 29; j++) {
            _pb[j] = [0, 0];
        }
    }

    // spruce with n drooping branch tiers into the reusable buffer (base centre x, b; half width w; height h)
    hidden function pine(dc as Dc, x, b, w, h, n) as Void {
        var pb = _pb;
        for (var k = 0; k < n; k++) {
            var yk = b - (h * k * 0.9) / n;
            var wk = w * (1 - k / n.toFloat());
            var yn = yk - (h * 0.5) / n;
            pb[k * 2][0] = x - wk; pb[k * 2][1] = yk;
            pb[k * 2 + 1][0] = x - wk * 0.32; pb[k * 2 + 1][1] = yn;
            pb[4 * n - k * 2][0] = x + wk; pb[4 * n - k * 2][1] = yk;
            pb[4 * n - k * 2 - 1][0] = x + wk * 0.32; pb[4 * n - k * 2 - 1][1] = yn;
        }
        pb[2 * n][0] = x;
        pb[2 * n][1] = b - h;
        dc.fillPolygon(n == 7 ? pb : pb.slice(0, 4 * n + 1));
    }

    // sky colours [zenith, horizon] for a sun elevation and style
    hidden function skyCols(st, el) as Array {
        var zn; var hn; var zt; var ht; var zd; var hd;
        if (st == 3) {
            zn = 0x010308; hn = 0x061A1A; zt = 0x0A1A3A; ht = 0x34507A; zd = 0x2A66B4; hd = 0x9CC8E8;
        } else {
            zn = 0x03050D; hn = 0x0B1730; zt = 0x0C1840; ht = 0x3A4F86; zd = 0x1F56A6; hd = 0x7CB2E2;
        }
        if (el >= 4) {
            return [zd, hd];
        }
        if (el >= -6) {
            var f = (el + 6) / 10.0;
            return [G.mix(zt, zd, f), G.mix(ht, hd, f)];
        }
        if (el >= -18) {
            var f = (el + 18) / 12.0;
            return [G.mix(zn, zt, f), G.mix(hn, ht, f)];
        }
        return [zn, hn];
    }

    // filled lens: limb on the side of unit vector (ux, uy), terminator at c * r
    hidden function lens(dc as Dc, x, y, r, ux, uy, c) as Void {
        var vx = -uy;
        var vy = ux;
        var pts = new [18];
        for (var i = 0; i <= 8; i++) {
            var t = (-90 + i * 22.5) * RAD;
            var a = r * Math.cos(t);
            var b = r * Math.sin(t);
            pts[i] = [x + ux * a + vx * b, y + uy * a + vy * b];
            a = a * c;
            pts[17 - i] = [x + ux * a + vx * b, y + uy * a + vy * b];
        }
        dc.fillPolygon(pts);
    }

    // moon in its real phase, lit side towards the sun
    hidden function moon(dc as Dc, x, y, r, ph, lit, dark) as Void {
        dc.setColor(dark, -1);
        dc.fillCircle(x, y, r);
        var il = (1 - Math.cos(ph * 2 * Math.PI)) / 2;
        if (il < 0.03) {
            return;
        }
        var ux = _sunX - _moX;
        var uy = _sunY - _moY;
        var l = Math.sqrt(ux * ux + uy * uy);
        if (l < 0.5) {
            ux = 1.0; uy = 0.0;
        } else {
            ux = ux / l; uy = uy / l;
        }
        dc.setColor(lit, -1);
        if (il > 0.97) {
            dc.fillCircle(x, y, r);
        } else {
            lens(dc, x, y, r, ux, uy, Math.cos(ph * 2 * Math.PI));
        }
    }

    // true if (x, y) lies under the text (time/date/slots) of style st
    hidden function under(st, x, y, tw) as Boolean {
        if (st == 3) {
            return (y > 66 && y < 156 && (x - CX).abs() < tw) || (y > 40 && y <= 66 && (x - CX).abs() < 76);
        }
        if (y > 136 && y < 262 && (x - CX).abs() < tw) {
            return true;
        }
        return y >= 262 && y < 318 && x > 72 && x < 382;
    }

    // a bright star (mag < 1.6) from palette entry pi = class * 16 + level
    hidden function star(dc as Dc, x, y, mag, pi) as Void {
        var q = pi % 16;
        var b = pi - q;
        if (mag < 0.6) {
            dc.setColor(_spal[b + (q * 0.22 + 0.5).toNumber()], -1);
            dc.fillCircle(x, y, 7);
            dc.setColor(_spal[b + (q * 0.5 + 0.5).toNumber()], -1);
            dc.fillRectangle(x - 9, y, 19, 1);
            dc.fillRectangle(x, y - 9, 1, 19);
            dc.setColor(_spal[pi], -1);
            dc.fillCircle(x, y, 3.2);
        } else {
            dc.setColor(_spal[b + (q * 0.4 + 0.5).toNumber()], -1);
            dc.fillRectangle(x - 4, y, 9, 1);
            dc.fillRectangle(x, y - 4, 1, 9);
            dc.setColor(_spal[pi], -1);
            dc.fillCircle(x, y, 2.4);
        }
    }

    // constellation labels for the resting sky: below each figure, no overlaps, max 3
    hidden function labels(st, R, tw) as Void {
        _nlb = 0;
        for (var c = 0; c < CN.size() && _nlb < 3; c++) {
            var nmc = CN[c] as String;
            if (nmc.length() == 0) {
                continue;
            }
            var s0 = CS[c * 2];
            var n = CS[c * 2 + 1];
            var sx = 0.0;
            var sy = 0.0;
            var ok = true;
            for (var k = s0; k < s0 + n; k++) {
                if (_su[k] <= 0.05) {
                    ok = false;
                    break;
                }
                sx += _sx[k];
                if (_sy[k] > sy) {
                    sy = _sy[k];
                }
            }
            if (!ok) {
                continue;
            }
            sx = sx / n;
            sy = sy + 7;
            if (c == 1) {
                sx = _sx[7];
                sy = _sy[7] + 7;
            }
            var lw = F.pxW(nmc, 2) / 2;
            var ddx = (sx - CX).abs() + lw;
            var ddy = (sy + 7 - CX).abs() + 7;
            if (ddx * ddx + ddy * ddy > (R - 4) * (R - 4)) {
                continue;
            }
            if (st == 3 && (sy + 44 > hy(sx) || sx < 96 || sx > 358)) {
                continue;
            }
            if (under(st, sx - lw, sy, tw) || under(st, sx + lw, sy, tw) || under(st, sx - lw, sy + 14, tw) || under(st, sx + lw, sy + 14, tw)) {
                continue;
            }
            var hit = false;
            for (var q = 0; q < _nlb; q++) {
                if ((_lbx[q] - sx).abs() < _lbw[q] + lw + 6 && (_lby[q] - sy).abs() < 18) {
                    hit = true;
                }
            }
            if (hit) {
                continue;
            }
            _lbx[_nlb] = sx;
            _lby[_nlb] = sy;
            _lbw[_nlb] = lw;
            _lbi[_nlb] = c;
            _nlb++;
        }
    }

    // aurora curtain envelope at azimuth az (deg from north, east positive), 0..1
    hidden function auS(az, t) {
        var e = 1 - (az / 82.0) * (az / 82.0);
        if (e <= 0) {
            return 0.0;
        }
        return G.clamp(0.42 + 0.7 * G.noise(az * 0.045 + t * 0.00032), 0.04, 1.0) * e;
    }

    // aurora over the northern horizon (style 3): rays from bright green (low) to violet (high).
    // refl: mirror image in the lake (dimmer, broken by ripples), reuses the main pass' rays
    hidden function aurora(dc as Dc, t, k, refl) as Void {
        dc.setPenWidth(refl ? 5 : 8);
        var o = refl ? 32 : 0;
        for (var i = 0; i < NA; i++) {
            var s;
            var fine;
            if (refl) {
                s = _as[i];
                fine = _af[i];
            } else {
                s = auS(-77 + i * 4.4, t);
                fine = 0.62 + 0.38 * G.noise(i * 1.41 + t * 0.0013);
                _as[i] = s;
                _af[i] = fine;
            }
            if (s < 0.06) {
                continue;
            }
            var q = (G.clamp(s * fine * k * 1.25, 0.0, 0.999) * 8).toNumber() + o;
            var L = (6 + 40 * s) * (0.8 + 0.2 * fine) * k;
            var bx = _abx[i];
            var by = _aby[i];
            var ux = _aux[i] * L;
            var uy = _auy[i] * L;
            if (refl) {
                var yr = _arh[i] - by + 6;
                dc.setColor(_ap[q], -1);
                dc.drawLine(bx, yr, bx + ux * 0.12, yr - uy * 0.12);
                dc.setColor(_ap[8 + q], -1);
                dc.drawLine(bx + ux * 0.2, yr - uy * 0.2 + 3, bx + ux * 0.32, yr - uy * 0.32 + 3);
                continue;
            }
            var x0 = bx;
            var y0 = by;
            for (var j = 0; j < 4; j++) {
                var f = j == 0 ? 0.3 : (j == 1 ? 0.55 : (j == 2 ? 0.8 : 1.0));
                var x = bx + ux * f;
                var y = by + uy * f;
                dc.setColor(_ap[j * 8 + q], -1);
                dc.setPenWidth(8 - j * 2);
                dc.drawLine(x0, y0, x, y);
                x0 = x;
                y0 = y;
            }
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var R = radius(st);
        if (st == 3) {
            panoInit();
        }
        sky(d, st, false);
        var EL = _el;
        var dark = G.clamp((-EL - 2) / 12.0, 0.0, 1.0);
        var sc = skyCols(st, EL);
        var zen = sc[0];
        var hor = sc[1];
        var bg = st == 2 ? PAPER : G.mix(hor, zen, st == 3 ? 0.45 : 0.5);
        var t = a.live ? a.t : 0;
        _fps = st == 2 ? 5 : (st == 3 && dark > 0.2 ? 12 : 8);
        var e = G.ease(p);
        var rest = p >= 1;
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var ts = hh + ":" + G.pad2(d.m);
        var th = st == 3 ? 76 : 84;
        var tw = F.stW(ts, th) / 2 + 14;
        var vis = st == 2 ? 1.0 : 0.16 + 0.84 * dark;
        var ns = ST.size();
        var nm = MW.size();

        // ---- paint state: palettes when the sky colour changes, star levels for the re-projected chunk
        if (_spb != bg * 4 + st) {
            _spb = bg * 4 + st;
            for (var c = 0; c < 4; c++) {
                var x = st == 2 ? INK : STAR_COL[c];
                for (var q = 0; q < 16; q++) {
                    _spal[c * 16 + q] = G.mix(bg, x, q / 15.0);
                }
            }
            var mwk = st == 2 ? 1 : dark;
            for (var i = 0; i < nm; i++) {
                var w = ((MW[i] & 511) + (MW[(i + 1) % nm] & 511)) / 200.0;
                if (st == 2) {
                    _mwc[i] = G.mix(bg, 0xCFCFC4, 0.5 * w * mwk);
                    _mwc[nm + i] = G.mix(bg, 0xCFCFC4, 0.85 * w * mwk);
                } else {
                    var x = st == 3 ? 0x24343E : 0x2A3658;
                    _mwc[i] = G.mix(bg, x, 0.45 * w * mwk);
                    _mwc[nm + i] = G.mix(bg, x, 0.7 * w * mwk);
                }
            }
        }
        for (var k = 0; k < _cl; k++) {
            var i = (_c0 + k) % ns;
            var f = 0.0;
            if (_su[i] > 0) {
                f = vis * G.clamp(1.25 - _mag[i] * 0.13, 0.45, 1.0);
                if (_su[i] < 0.12) {
                    f = f * (0.45 + _su[i] * 4.5);
                }
                if (under(st, _sx[i], _sy[i], tw)) {
                    f = f * 0.55;
                }
            }
            _sff[i] = f;
            var q = (f * 15 + 0.5).toNumber();
            _sci[i] = q > 0 ? (ST[i] & 3) * 16 + q : -1;
        }
        if (rest && _lk != _kd) {
            _lk = _kd;
            labels(st, R, tw);
        }

        // ---- intro: the dome turns into place (1, 2) / the sky rises (3)
        var rot = st == 3 ? 0.0 : -50 * (1 - e);
        var cr = Math.cos(rot * RAD);
        var sr = Math.sin(rot * RAD);
        var lift = st == 3 ? 36 * (1 - e) : 0.0;
        var rx = rest ? _sx : _rx;
        var ry = rest ? _sy : _ry;
        if (!rest) {
            for (var i = 0; i < ns; i++) {
                if (_su[i] <= 0) {
                    continue;
                }
                if (st == 3) {
                    _rx[i] = _sx[i];
                    _ry[i] = _sy[i] + lift;
                } else {
                    var dx = _sx[i] - CX;
                    var dy = _sy[i] - CX;
                    _rx[i] = CX + dx * cr - dy * sr;
                    _ry[i] = CX + dx * sr + dy * cr;
                }
            }
        }

        // ---- background
        if (st == 2) {
            dc.setColor(PAPER, -1);
            dc.fillCircle(CX, CX, 227);
        } else if (st == 3) {
            for (var k = 0; k < 15; k++) {
                dc.setColor(G.mix(zen, hor, Math.pow(k / 14.0, 1.6)), -1);
                dc.fillRectangle(0, k * 20, 454, 20);
            }
        } else {
            // radial gradient: 10 concentric rings, horizon -> zenith
            var rw = R / 10.0;
            dc.setPenWidth(rw + 2);
            for (var k = 0; k < 10; k++) {
                dc.setColor(G.mix(hor, zen, Math.pow((k + 0.5) / 10.0, 0.6)), -1);
                if (k < 9) {
                    dc.drawCircle(CX, CX, R - rw * (k + 0.5));
                } else {
                    dc.fillCircle(CX, CX, rw + 1);
                }
            }
        }
        // twilight glow around the sun's direction (masked by rim / lake)
        var gl = st == 2 ? 0 : 1 - (EL + 3).abs() / 10.0;
        if (gl > 0) {
            var gx = _sunX - CX;
            var gy = _sunY - CX;
            if (st == 3) {
                gx = G.clamp(gx, -260, 260);
                gy = hy(CX + G.clamp(gx, -227, 227)) - CX;
            } else {
                var gr = Math.sqrt(gx * gx + gy * gy);
                if (gr > R * 1.15) {
                    gx = gx * R * 1.15 / gr;
                    gy = gy * R * 1.15 / gr;
                }
            }
            for (var k = 0; k < 9; k++) {
                dc.setColor(G.mix(hor, k > 5 ? 0xFFD08A : 0xF0905A, gl * (0.08 + k * 0.055)), -1);
                dc.fillCircle(CX + gx, CX + gy, 160 - k * 16);
            }
        }

        // ---- Milky Way
        if (st == 2 || dark > 0.05) {
            for (var pass = 0; pass < 2; pass++) {
                dc.setPenWidth(pass == 0 ? 30 : 12);
                for (var i = 0; i < nm; i++) {
                    var j = i + 1 < nm ? i + 1 : 0;
                    if (_wu[i] < -0.2 || _wu[j] < -0.2) {
                        continue;
                    }
                    dc.setColor(_mwc[pass * nm + i], -1);
                    if (rest || st == 3) {
                        dc.drawLine(_wx[i], _wy[i] + lift, _wx[j], _wy[j] + lift);
                    } else {
                        var ax = _wx[i] - CX;
                        var ay = _wy[i] - CX;
                        var bx = _wx[j] - CX;
                        var by = _wy[j] - CX;
                        dc.drawLine(CX + ax * cr - ay * sr, CX + ax * sr + ay * cr, CX + bx * cr - by * sr, CX + bx * sr + by * cr);
                    }
                }
            }
        }

        // ---- grid: altitude circles 30° / 60° (+ azimuth spokes on the chart)
        dc.setPenWidth(1);
        if (st == 2) {
            dc.setColor(0xCDB88E, -1);
            dc.drawCircle(CX, CX, R * 0.577);
            dc.drawCircle(CX, CX, R * 0.268);
            for (var k = 0; k < 12; k++) {
                G.tick(dc, CX, CX, R * 0.268, R, k * 30);
            }
        } else if (st == 1) {
            dc.setColor(G.mix(bg, acc, 0.16), -1);
            dc.drawCircle(CX, CX, R * 0.577);
            dc.drawCircle(CX, CX, R * 0.268);
        }

        // ---- aurora (behind the stars); palettes for sky + lake only change with k
        var ak = st == 3 ? dark * e : 0.0;
        var wt = G.mix(hor, 0x000000, 0.55);
        if (ak > 0.02) {
            if (_apk != ak || _apb != bg) {
                _apk = ak;
                _apb = bg;
                for (var j = 0; j < 4; j++) {
                    for (var q = 0; q < 8; q++) {
                        _ap[j * 8 + q] = G.mix(bg, AUC[j], AUA[j] * (q + 0.5) / 8.0);
                        _ap[32 + j * 8 + q] = G.mix(wt, AUC[j], AUA[j] * (q + 0.5) * 0.42 / 8.0);
                    }
                }
            }
            aurora(dc, t, ak, false);
        }

        // ---- constellation figures (draw on after the stars appear)
        var lp = G.clamp((p - 0.45) / 0.5, 0.0, 1.0);
        if (lp > 0) {
            dc.setColor(st == 2 ? G.mix(bg, 0x5A6278, 0.75) : G.mix(bg, st == 3 ? 0x8FD8C0 : acc, 0.18 + 0.22 * dark), -1);
            dc.setPenWidth(1);
            var nl = LN.size();
            for (var i = 0; i < nl; i++) {
                var sa = LN[i] >> 8;
                var sb = LN[i] & 255;
                if (_su[sa] <= 0 || _su[sb] <= 0) {
                    continue;
                }
                if (rest) {
                    dc.drawLine(rx[sa], ry[sa], rx[sb], ry[sb]);
                } else {
                    dc.drawLine(rx[sa], ry[sa], rx[sa] + (rx[sb] - rx[sa]) * lp, ry[sa] + (ry[sb] - ry[sa]) * lp);
                }
            }
        }

        // ---- stars (brightest first during the intro; the bright ones twinkle while awake)
        var thr = -1.5 + 7.5 * G.ease(p * 1.3);
        var twk = st != 2 && a.live && rest;
        for (var i = 0; i < ns; i++) {
            var pi = _sci[i];
            if (pi < 0 || _su[i] <= 0) {
                continue;
            }
            var mag = _mag[i];
            if (!rest) {
                if (mag > thr) {
                    continue;
                }
                var q = (_sff[i] * G.clamp(thr - mag, 0.0, 1.0) * 15 + 0.5).toNumber();
                if (q <= 0) {
                    continue;
                }
                pi = (ST[i] & 3) * 16 + q;
            } else if (twk && mag < 2) {
                pi = (ST[i] & 3) * 16 + (_sff[i] * (0.8 + 0.2 * G.noise(t * 0.004 + i * 1.37)) * 15 + 0.5).toNumber();
            }
            if (st != 2 && mag < 1.6) {
                star(dc, rx[i], ry[i], mag, pi);
            } else {
                dc.setColor(_spal[pi], -1);
                if (st == 2) {
                    // ink dots sized by magnitude (small ones as two crossed rectangles: round and cheap)
                    var r = 4.4 - mag * 0.75;
                    if (r >= 3) {
                        dc.fillCircle(rx[i], ry[i], r);
                    } else if (r >= 2.2) {
                        dc.fillRectangle(rx[i] - 2, ry[i] - 1, 5, 3);
                        dc.fillRectangle(rx[i] - 1, ry[i] - 2, 3, 5);
                    } else {
                        dc.fillRectangle(rx[i] - 1, ry[i] - 1, r >= 1.5 ? 3 : 2, r >= 1.5 ? 3 : 2);
                    }
                } else {
                    dc.fillRectangle(rx[i] - 1, ry[i] - 1, mag < 2.6 ? 3 : 2, mag < 2.6 ? 3 : 2);
                }
            }
        }
        // Pleiades (star 48 = Alcyone)
        if (_su[48] > 0 && thr > 3) {
            dc.setColor(_spal[(10 * vis).toNumber()], -1);
            dc.fillRectangle(rx[48] - 5, ry[48] - 3, 2, 2);
            dc.fillRectangle(rx[48] + 3, ry[48] - 4, 2, 2);
            dc.fillRectangle(rx[48] - 3, ry[48] + 3, 2, 2);
            dc.fillRectangle(rx[48] + 4, ry[48] + 2, 2, 2);
        }

        // ---- constellation names (resting frame)
        if (rest && (st == 2 || dark > 0.4)) {
            dc.setColor(st == 2 ? 0x8A5A3A : G.mix(bg, st == 3 ? 0x8FD8C0 : acc, 0.3 + 0.25 * dark), -1);
            for (var q = 0; q < _nlb; q++) {
                F.px(dc, CN[_lbi[q]] as String, _lbx[q], _lby[q], 2, 1, 0);
            }
        }

        // ---- sun and moon
        var pop = G.spring(G.stag(p, 0, 0.3, 0.5));
        if (_sunU > -0.02 && pop > 0) {
            if (st == 2) {
                dc.setColor(0xB03A2A, -1);
                dc.setPenWidth(2);
                dc.drawCircle(_sunX, _sunY, 10 * pop);
                dc.fillCircle(_sunX, _sunY, 3 * pop);
                for (var k = 0; k < 8; k++) {
                    G.tick(dc, _sunX, _sunY, 14 * pop, 19 * pop, k * 45);
                }
            } else {
                dc.setColor(G.mix(bg, 0xFFF0C0, 0.25), -1);
                dc.fillCircle(_sunX, _sunY, 22 * pop);
                dc.setColor(G.mix(bg, 0xFFF0C0, 0.5), -1);
                dc.fillCircle(_sunX, _sunY, 15 * pop);
                dc.setColor(0xFFFBE8, -1);
                dc.fillCircle(_sunX, _sunY, 10 * pop);
            }
        }
        var mx = _moX;
        var my = _moY + lift;
        if (rot != 0) {
            var dx = mx - CX;
            var dy = my - CX;
            mx = CX + dx * cr - dy * sr;
            my = CX + dx * sr + dy * cr;
        }
        var moonUp = _moU > -0.02 && pop > 0;
        if (moonUp) {
            if (st == 2) {
                moon(dc, mx, my, 11 * pop, d.moon, PAPER, 0x2A3044);
                dc.setColor(INK, -1);
                dc.setPenWidth(2);
                dc.drawCircle(mx, my, 11 * pop);
            } else {
                dc.setColor(G.mix(bg, 0xE8ECFF, 0.12), -1);
                dc.fillCircle(mx, my, 17 * pop);
                moon(dc, mx, my, 11 * pop, d.moon, 0xF4F0DC, G.mix(bg, 0x39405A, 0.6));
            }
        }

        // ---- shooting star: one per wrist raise (dark sky)
        if (a.live && rest && (st == 2 || dark > 0.5)) {
            var s = G.rnd(d.wakeN * 7919 + 13);
            var t0 = 1800 + (s % 4200);
            var u = (t - t0) / 900.0;
            if (u > 0 && u < 1) {
                s = G.rnd(s);
                var x0;
                var y0;
                var dir;
                if (st == 3) {
                    x0 = 110 + (s % 234);
                    s = G.rnd(s);
                    y0 = 150 + (s % 60);
                    s = G.rnd(s);
                    dir = 200 + (s % 80) + (x0 > CX ? 0 : -60);
                } else {
                    var ang = s % 360;
                    s = G.rnd(s);
                    var rr = 70 + (s % 90);
                    s = G.rnd(s);
                    dir = ang + 100 + (s % 40);
                    x0 = G.ptX(CX, rr, ang);
                    y0 = G.ptY(CX, rr, ang);
                }
                var hd = 150 * G.ease(u);
                var fade = u < 0.7 ? 1.0 : (1 - u) / 0.3;
                for (var k = 0; k < 3; k++) {
                    var a0 = G.clamp(hd - 22 - k * 22, 0, 999);
                    var a1 = G.clamp(hd - k * 22, 0, 999);
                    if (a1 <= a0) {
                        continue;
                    }
                    dc.setColor(G.mix(bg, st == 2 ? INK : 0xFFFFFF, fade * (1 - k * 0.32)), -1);
                    dc.setPenWidth(k == 0 ? 2 : 1);
                    dc.drawLine(G.ptX(x0, a1, dir), G.ptY(y0, a1, dir), G.ptX(x0, a0, dir), G.ptY(y0, a0, dir));
                }
            }
        }

        // ---- landscape (3) / rim with compass (1, 2)
        var day = EL > 0;
        if (st == 3) {
            // lake: shore strip (offset copy of the water polygon), water, depth bands
            var lk = _lake;
            for (var j = 0; j < 29; j++) {
                lk[j][0] = j * 16;
                lk[j][1] = _hz[j * 2] - 1;
            }
            lk[29][0] = 456; lk[29][1] = _hz[57] - 1;
            lk[30][0] = 456; lk[30][1] = 456;
            lk[31][0] = 0; lk[31][1] = 456;
            var tc = G.mix(0x010302, 0x10261E, G.clamp((EL + 6) / 12.0, 0.0, 1.0));
            dc.setColor(tc, -1);
            dc.fillPolygon(lk);
            for (var j = 0; j < 30; j++) {
                lk[j][1] = lk[j][1] + 5;
            }
            dc.setColor(wt, -1);
            dc.fillPolygon(lk);
            var lb = G.mix(zen, 0x000000, 0.7);
            for (var k = 0; k < 8; k++) {
                dc.setColor(G.mix(wt, lb, (k + 1) / 8.0), -1);
                dc.fillRectangle(0, 300 + k * 20, 454, 20);
            }
            if (ak > 0.02) {
                aurora(dc, t, ak, true);
            }
            // moon glitter on the water
            if (moonUp && my < hy(mx) && mx > 30 && mx < 424) {
                var h0 = hy(mx);
                for (var k = 0; k < 7; k++) {
                    var w = 16 - k * 1.6 + 3 * G.noise(k * 1.7 + t * 0.002);
                    dc.setColor(G.mix(wt, 0xF4F0DC, 0.5 - k * 0.055), -1);
                    dc.fillRectangle(mx - w / 2, h0 + 8 + k * 9, w, 2);
                }
            }
            // far shore forest
            dc.setColor(tc, -1);
            var tri = _tri;
            for (var i = 0; i < NT; i++) {
                var x = _trx[i];
                var b = _trb[i];
                var w = _trw[i];
                tri[0][0] = x - w; tri[0][1] = b;
                tri[1][0] = x; tri[1][1] = b - _trh[i];
                tri[2][0] = x + w; tri[2][1] = b;
                dc.fillPolygon(tri);
            }
            // near spruces framing the view
            dc.setColor(0x000000, -1);
            pine(dc, 30, 430, 58, 270, 7);
            pine(dc, 78, 450, 34, 190, 5);
            pine(dc, 424, 430, 58, 280, 7);
            pine(dc, 380, 452, 32, 170, 5);
            dc.setColor(G.mix(wt, 0x8FD8C0, 0.5), -1);
            F.px(dc, "N", CX, hy(CX) + 10, 2, 1, 0);
            F.px(dc, "NW", 101, hy(101) + 10, 2, 1, 0);
            F.px(dc, "NO", 353, hy(353) + 10, 2, 1, 0);
        } else {
            var rim = st == 2 ? 0x1D2A48 : 0x04060C;
            dc.setColor(rim, -1);
            dc.setPenWidth(36);
            dc.drawCircle(CX, CX, R + 18);
            var ink = st == 2 ? 0xE9DFC4 : G.mix(rim, acc, 0.55);
            dc.setColor(ink, -1);
            dc.setPenWidth(st == 2 ? 2 : 1);
            dc.drawCircle(CX, CX, R + 1);
            dc.setPenWidth(1);
            // azimuth scale every 10° (unit vector rotated step by step, no trig per tick)
            var c10 = 0.98480775;
            var s10 = 0.17364818;
            var ux = 0.0;
            var uy = -1.0;
            for (var k = 0; k < 36; k++) {
                if (k % 9 != 0) {
                    var r2 = R + (k % 3 == 0 ? 11 : 6);
                    dc.drawLine(CX + ux * (R + 3), CX + uy * (R + 3), CX + ux * r2, CX + uy * r2);
                }
                var nx = ux * c10 - uy * s10;
                uy = uy * c10 + ux * s10;
                ux = nx;
            }
            // seconds pointer on the printed chart's cover
            if (st == 2 && a.live && rest) {
                var sa = (d.s + a.ms / 1000.0) * 6;
                dc.setColor(0xE2574A, -1);
                dc.fillPolygon([[G.ptX(CX, R + 3, sa), G.ptY(CX, R + 3, sa)], [G.ptX(CX, R + 13, sa - 2.6), G.ptY(CX, R + 13, sa - 2.6)],
                    [G.ptX(CX, R + 13, sa + 2.6), G.ptY(CX, R + 13, sa + 2.6)]]);
            }
            var lr = R + 19;
            dc.setColor(st == 2 ? 0xE2574A : acc, -1);
            F.st(dc, "N", CX, CX - lr, 15, 2, 1, 1.0, 0);
            dc.setColor(ink, -1);
            F.st(dc, "S", CX, CX + lr, 15, 2, 1, 1.0, 0);
            F.st(dc, "O", CX - lr, CX, 15, 2, 1, 1.0, 0);
            F.st(dc, "W", CX + lr, CX, 15, 2, 1, 1.0, 0);
        }

        // ---- text
        var tcol = st == 2 ? INK : (st == 3 ? 0xEAFFF4 : 0xFFFFFF);
        var dcl = st == 2 ? 0xA8322A : (st == 3 ? (day ? 0xEAFFF4 : 0x8FE8C0) : (day ? 0xFFFFFF : acc));
        dc.setColor(dcl, -1);
        F.st(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, st == 3 ? 54 : 150, 17, 2, 1, G.ease(p * 1.6), 0);
        dc.setColor(tcol, -1);
        F.st(dc, ts, CX, st == 3 ? 112 : 206, th, st == 2 ? 6 : 7, 1, G.easeInOut(p * 1.15), 0);
        var sy0 = st == 3 ? 352 : 268;
        var sb = st == 3 ? G.mix(hor, 0x000000, 0.6) : bg;
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var x = CX + (k - 1) * 100;
            var s2 = G.stag(p, k, 0.12, 0.5);
            if (s2 <= 0) {
                continue;
            }
            dc.setColor(G.mix(sb, st == 2 ? 0x6A6050 : (st == 3 ? 0x7AA89A : (day ? 0xE0ECFF : 0x8A93A8)), s2), -1);
            F.px(dc, sl[:lbl] as String, x, sy0, 2, 1, 0);
            dc.setColor(G.mix(sb, st == 2 ? INK : d.dcol, s2), -1);
            F.st(dc, sl[:val] as String, x, sy0 + 30, 20, 2, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var st = d.cfg.style;
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        if (st == 3) {
            panoInit();
        }
        sky(d, st, true);
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var ts = hh + ":" + G.pad2(d.m);
        var th = st == 3 ? 76 : 84;
        var tw = F.stW(ts, th) / 2 + 14;
        dc.setColor(0x2A3040, -1);
        if (st == 3) {
            for (var j = 1; j < 57; j++) {
                dc.fillRectangle(j * 8 + ox, _hz[j] + oy, 2, 2);
            }
        } else {
            var rr = radius(st) + 1;
            for (var k = 0; k < 72; k++) {
                dc.fillRectangle(G.ptX(CX + ox, rr, k * 5) - 1, G.ptY(CX + oy, rr, k * 5) - 1, 2, 2);
            }
        }
        dc.setColor(0x1E2432, -1);
        dc.setPenWidth(1);
        var nl = LN.size();
        for (var i = 0; i < nl; i++) {
            var sa = LN[i] >> 8;
            var sb = LN[i] & 255;
            if (_su[sa] <= 0 || _su[sb] <= 0) {
                continue;
            }
            dc.drawLine(_sx[sa] + ox, _sy[sa] + oy, _sx[sb] + ox, _sy[sb] + oy);
        }
        var ns = ST.size();
        for (var i = 0; i < ns; i++) {
            if (_su[i] <= 0.03) {
                continue;
            }
            var mag = _mag[i];
            if (mag > 2.6 || under(st, _sx[i], _sy[i], tw)) {
                continue;
            }
            dc.setColor(mag < 1 ? 0xB4BAC8 : 0x6E7488, -1);
            dc.fillRectangle(_sx[i] + ox - 1, _sy[i] + oy - 1, mag < 1 ? 3 : 2, mag < 1 ? 3 : 2);
        }
        if (_moU > 0) {
            moon(dc, _moX + ox, _moY + oy, 9, d.moon, 0x6A6A5E, 0x161616);
        }
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, ts, CX + ox, (st == 3 ? 112 : 206) + oy, th, 3, 1, 1.0, 0);
        dc.setColor(G.dim(d.accent, 0.55), -1);
        F.st(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX + ox, (st == 3 ? 54 : 150) + oy, 17, 2, 1, 1.0, 0);
    }
}
