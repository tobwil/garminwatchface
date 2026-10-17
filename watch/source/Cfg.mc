import Toybox.Application;
import Toybox.Application.WatchFaceConfig;
import Toybox.Complications;
import Toybox.Lang;
import Toybox.System;
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
    var src as Number = 0;      // progress source for challenge faces: 0 climb (floors), 1 bike km, 2 training days
    var dayGoal as Number = 4;  // training days per week

    function initialize() {
    }

    function toArray() as Array<Number> {
        return [style, accent, dcol, slots[0], slots[1], slots[2], ftp, kg, climb, quest, anim, bikeGoal, src, dayGoal];
    }

    function fromArray(a as Array) as Void {
        if (a.size() < 12) {
            return;
        }
        style = a[0]; accent = a[1]; dcol = a[2];
        slots = [a[3], a[4], a[5]];
        ftp = a[6]; kg = a[7]; climb = a[8]; quest = a[9]; anim = a[10]; bikeGoal = a[11];
        if (a.size() >= 14) {
            src = a[12]; dayGoal = a[13];
        }
    }

    // FL1.<face>.<style>.<accent>.<dcol>.<s1>-<s2>-<s3>.<ftp>.<kg>.<climb>.<quest>.<anim>.<bikeGoal>[.<src>.<dayGoal>]
    // (<face> selects the design in the studio; each .prg contains exactly one design.
    //  The last two fields are optional for codes from the first studio version.)
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
        src = p.size() > 12 ? num(p[12], 0, 2, 0) : 0;
        dayGoal = p.size() > 13 ? num(p[13], 1, 7, 4) : 4;
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
        if (Registry.DEBUG) {
            System.println("baked " + baked + " seen " + seen + " stored " + stored);
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

    // Merge the native watch face editor settings: only fields that changed since
    // we last looked are applied (so a freshly baked Face-Code is not overridden
    // by the editor's defaults). force=true (editor event) also applies when no
    // previous snapshot exists.
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
            if (Registry.DEBUG) {
                System.println("native snap " + snap + " prev " + prev + " force " + force + " style " + style);
            }
            // apply only the fields the user actually changed in the editor, so a
            // baked style is not reset when only the colour is edited
            if (prev != null || force) {
                var any = false;
                for (var k = 0; k < 6; k++) {
                    var v = snap[k];
                    var moved = prev == null ? force : (prev.size() > k && prev[k] != v);
                    if (!moved || v == -1 || (k != 1 && k != 2 && v <= 0)) {
                        continue;
                    }
                    any = true;
                    if (k == 0) { style = v; }
                    else if (k == 1) { accent = v & 0xFFFFFF; }
                    else if (k == 2) { dcol = v & 0xFFFFFF; }
                    else { slots[k - 3] = v; }
                }
                if (any) {
                    save();
                }
            }
            Application.Storage.setValue("nsnap", snap);
        } catch (e) {
        }
    }
}
