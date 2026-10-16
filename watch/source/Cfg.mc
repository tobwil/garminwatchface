import Toybox.Application;
import Toybox.Application.WatchFaceConfig;
import Toybox.Complications;
import Toybox.Lang;
import Toybox.WatchUi;

// Configuration. Sources, in order of precedence:
//  1. Native watch face editor on the watch (style, accent, data colour, data slots)
//  2. On-device settings menu (Menu.mc) — stored in Application.Storage
//  3. Face-Code baked into the .prg by the FaceLab studio (string resource FaceCode)
// Mirrors encodeCode()/decodeCode() in web/js/engine/model.js.
class Cfg {
    var style as Number = 1;
    var accent as Number = 0xFF5A1F;
    var dcol as Number = 0xFFFFFF;
    var slots as Array<Number> = [23, 21, 20];
    var ftp as Number = 250;
    var kg as Number = 75;
    var climb as Number = 0;
    var quest as Number = 1;
    var anim as Number = 2;
    var bikeGoal as Number = 150;

    function initialize() {
    }

    function toArray() as Array<Number> {
        return [style, accent, dcol, slots[0], slots[1], slots[2], ftp, kg, climb, quest, anim, bikeGoal];
    }

    function fromArray(a as Array) as Void {
        if (a.size() < 12) {
            return;
        }
        style = a[0]; accent = a[1]; dcol = a[2];
        slots = [a[3], a[4], a[5]];
        ftp = a[6]; kg = a[7]; climb = a[8]; quest = a[9]; anim = a[10]; bikeGoal = a[11];
    }

    // FL1.<face>.<style>.<accent>.<dcol>.<s1>-<s2>-<s3>.<ftp>.<kg>.<climb>.<quest>.<anim>.<bikeGoal>
    // (<face> selects the design in the studio; each .prg contains exactly one design.)
    function decode(code as String) as Boolean {
        var p = split(code, '.');
        if (p.size() < 12 || !p[0].equals("FL1")) {
            return false;
        }
        style = num(p[2], 1, 9, 1);
        accent = hex(p[3], 0xFF5A1F);
        dcol = hex(p[4], 0xFFFFFF);
        var s = split(p[5], '-');
        slots = [0, 0, 0];
        for (var i = 0; i < 3 && i < s.size(); i++) {
            slots[i] = num(s[i], 0, 99, 0);
        }
        ftp = num(p[6], 50, 600, 250);
        kg = num(p[7], 30, 200, 75);
        climb = num(p[8], 0, 3, 0);
        quest = num(p[9], 0, 2, 1);
        anim = num(p[10], 0, 2, 2);
        bikeGoal = num(p[11], 0, 2000, 150);
        return true;
    }

    static function split(s as String, sep as Char) as Array<String> {
        var out = [] as Array<String>;
        var cs = s.toCharArray();
        var cur = "";
        for (var i = 0; i < cs.size(); i++) {
            if (cs[i] == sep) {
                out.add(cur);
                cur = "";
            } else {
                cur += cs[i].toString();
            }
        }
        out.add(cur);
        return out;
    }

    static function num(s as String, lo as Number, hi as Number, def as Number) as Number {
        var v = s.toNumber();
        if (v == null) {
            return def;
        }
        return v < lo ? lo : (v > hi ? hi : v);
    }

    static function hex(s as String, def as Number) as Number {
        var v = s.toNumberWithBase(16);
        return v == null ? def : v;
    }

    // -------------------------------------------------------------- loading
    function load() as Void {
        var baked = bakedCode();
        var stored = null;
        var seen = null;
        try {
            stored = Application.Storage.getValue("cfg");
            seen = Application.Storage.getValue("baked");
        } catch (e) {
        }
        if (stored == null || seen == null || !(seen as String).equals(baked)) {
            decode(baked);
            save();
            try {
                Application.Storage.setValue("baked", baked);
            } catch (e) {
            }
        } else {
            fromArray(stored as Array);
        }
        syncNative(false);
    }

    function save() as Void {
        try {
            Application.Storage.setValue("cfg", toArray());
        } catch (e) {
        }
    }

    static function bakedCode() as String {
        var s = WatchUi.loadResource(Rez.Strings.FaceCode) as String;
        if (s.length() > 7 && s.substring(0, 7).equals("FLCODE:")) {
            s = s.substring(7, s.length());
        }
        // trim padding
        var cs = s.toCharArray();
        var end = cs.size();
        while (end > 0 && (cs[end - 1] == ' ' || cs[end - 1] == '#')) {
            end--;
        }
        return s.substring(0, end);
    }

    // Merge the native watch face editor settings. With force=false they are
    // only applied when they changed since we last looked (so a freshly baked
    // Face-Code is not overridden by the editor's defaults).
    function syncNative(force as Boolean) as Void {
        if (!(Application has :WatchFaceConfig)) {
            return;
        }
        try {
            var st = WatchFaceConfig.getSettings(null);
            if (st == null) {
                return;
            }
            var snap = [-1, -1, -1, -1, -1, -1];
            if (st.styleId != null) { snap[0] = st.styleId; }
            if (st.accentColor != null && st.accentColor.color != null) { snap[1] = st.accentColor.color; }
            if (st.complicationColor != null && st.complicationColor.color != null) { snap[2] = st.complicationColor.color; }
            var cs = st.complicationSettings;
            if (cs != null) {
                for (var i = 0; i < cs.size(); i++) {
                    var u = cs[i].uniqueIdentifier;
                    var cid = cs[i].complicationId;
                    if (u != null && u >= 1 && u <= 3 && cid != null) {
                        snap[2 + u] = cid.getType();
                    }
                }
            }
            var prev = Application.Storage.getValue("nsnap") as Array?;
            var changed = prev == null ? false : !same(prev, snap);
            if (force || changed) {
                if (snap[0] > 0) { style = snap[0]; }
                if (snap[1] != -1) { accent = snap[1] & 0xFFFFFF; }
                if (snap[2] != -1) { dcol = snap[2] & 0xFFFFFF; }
                for (var j = 0; j < 3; j++) {
                    if (snap[3 + j] > 0) { slots[j] = snap[3 + j]; }
                }
                save();
            }
            Application.Storage.setValue("nsnap", snap);
        } catch (e) {
        }
    }

    static function same(a as Array, b as Array) as Boolean {
        if (a.size() != b.size()) {
            return false;
        }
        for (var i = 0; i < a.size(); i++) {
            if (a[i] != b[i]) {
                return false;
            }
        }
        return true;
    }
}
