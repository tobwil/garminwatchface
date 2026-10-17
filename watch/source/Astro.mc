import Toybox.Lang;
import Toybox.Math;

// AST — sun & moon maths (NOAA approximation). Mirrors web/js/engine/astro.js.
module AST {
    const RAD = 0.017453292519943295;
    const TAU = 6.283185307179586;

    function sun(doy, hourUtc) as Array<Float> {
        var g = (TAU / 365.0) * (doy - 1 + (hourUtc - 12) / 24.0);
        var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
        var de = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
        return [eq.toFloat(), de.toFloat()];
    }

    // Sun elevation in degrees at local minute-of-day. tz = UTC offset in minutes.
    function elev(doy, min, lat, lon, tz) as Float {
        var s = sun(doy, (min - tz) / 60.0);
        var tst = min + s[0] + 4 * lon - tz;
        var ha = (tst / 4.0 - 180) * RAD;
        var la = lat * RAD;
        var cz = Math.sin(la) * Math.sin(s[1]) + Math.cos(la) * Math.cos(s[1]) * Math.cos(ha);
        if (cz > 1) { cz = 1; }
        if (cz < -1) { cz = -1; }
        return (90 - Math.acos(cz) / RAD).toFloat();
    }

    // Local minute-of-day when the sun crosses elevation el. -1 if never.
    function cross(doy, lat, lon, tz, el, rising) as Float {
        var s = sun(doy, 12 - tz / 60.0);
        var la = lat * RAD;
        var c = (Math.sin(el * RAD) - Math.sin(la) * Math.sin(s[1])) / (Math.cos(la) * Math.cos(s[1]));
        if (c < -1 || c > 1) {
            return -1.0;
        }
        var ha = Math.acos(c) / RAD;
        var utc = 720 - 4 * (lon + (rising ? ha : -ha)) - s[0];
        return wrap(utc + tz);
    }

    function noon(doy, lon, tz) as Float {
        var s = sun(doy, 12 - tz / 60.0);
        return wrap(720 - 4 * lon - s[0] + tz);
    }

    function wrap(v) as Float {
        v = v.toFloat();
        while (v < 0) { v += 1440.0; }
        while (v >= 1440) { v -= 1440.0; }
        return v;
    }

    // Moon phase 0..1 (0 new, 0.5 full) from unix seconds.
    function moon(unix) as Float {
        var jd = unix.toDouble() / 86400.0 + 2440587.5;
        var p = 29.530588853;
        var age = jd - 2451550.1;
        age = age - p * Math.floor(age / p);
        return (age / p).toFloat();
    }

    function illum(phase) as Float {
        return ((1 - Math.cos(phase * TAU)) / 2.0).toFloat();
    }
}
