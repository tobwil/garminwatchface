import Toybox.Activity;
import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Complications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.UserProfile;
import Toybox.Weather;

// D — the data snapshot handed to every face. Field names match
// buildData() in web/js/engine/model.js. Unknown numbers are -1.
class D {
    // time
    var h = 0; var m = 0; var s = 0; var is24 = true;
    var dow = 0; var day = 1; var mon = 1; var year = 2026; var doy = 1; var wk = 1;
    var dowStr = "MO"; var monStr = "JAN"; var unix = 0; var tz = 0; var mins = 0;
    // activity
    var steps = 0; var stepGoal = 10000; var floors = 0; var floorsGoal = 10; var floorsWeek = 0;
    var imWeek = 0; var imGoal = 150; var kcal = 0; var distM = 0;
    // current ISO week, Monday = index 0. Future days are -1.
    var dayIdx = 0;
    var wkSteps = [-1, -1, -1, -1, -1, -1, -1] as Array<Number>;
    var wkFloors = [-1, -1, -1, -1, -1, -1, -1] as Array<Number>;
    var wkAct = [-1, -1, -1, -1, -1, -1, -1] as Array<Number>;   // active (intensity) minutes per day
    var glances = 0;    // wrist raises (wake-ups) today
    var wakeN = 0;      // wake-ups since install: changes with every raise (seed for "new answer each look")
    var trainMask = 0;  // bit n = training day on weekday n (Mon = bit 0)
    var trainDays = 0;
    var dayGoal = 4;
    var src = 0;
    // body
    var hr = -1; var rhr = -1; var hrMax = 190;
    var hrHist = [] as Array<Number>;
    var bb = -1; var bbHist = [] as Array<Number>;
    var stress = -1; var stressHist = [] as Array<Number>;
    var sleep = -1; var recov = -1; var vo2b = -1; var vo2r = -1; var wkBike = -1; var wkRun = -1;
    var tStatus = "";
    var p5k = -1; var p10k = -1; var pHM = -1; var pM = -1; var resp = -1; var spo2 = -1;
    // environment
    var temp = -99; var cond = -1; var wind = -1; var windDeg = 0; var rain = -1; var hiT = -99; var loT = -99;
    var alt = -1; var pres = -1;
    var lat = 50.11; var lon = 8.68; var locOk = false;
    var sunrise = -1.0; var sunset = -1.0; var moon = 0.0;
    // device
    var batt = 0; var battDays = -1; var charging = false; var notif = 0; var phone = false; var dnd = false; var alarms = 0;
    var nextEv = -1; // next calendar event, minutes since midnight (-1 none)
    var metric = true;
    // config
    var cfg as Cfg;
    var accent = 0xFF5A1F; var dcol = 0xFFFFFF;
    var slots = [] as Array<Dictionary>;

    hidden var _lastSlow = -1;
    hidden var _lastHist = -1;
    hidden var _hrSec = -1;
    hidden var _hrLive = -1;

    const DOW = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
    const MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

    function initialize(c as Cfg) {
        cfg = c;
    }

    // Called every frame: cheap clock fields. Every minute (or when forced): everything else.
    function clock() as Void {
        var ct = System.getClockTime();
        h = ct.hour; m = ct.min; s = ct.sec;
        tz = ct.timeZoneOffset / 60;
        mins = h * 60 + m;
    }

    // Returns true if the slow reads ran (once a minute or when forced).
    function refresh(force as Boolean) as Boolean {
        clock();
        var minuteKey = mins;
        if (!force && minuteKey == _lastSlow) {
            return false;
        }
        _lastSlow = minuteKey;
        accent = cfg.accent;
        dcol = cfg.dcol;
        try { readDate(); } catch (e) { }
        try { readDevice(); } catch (e) { }
        try { readActivity(); } catch (e) { }
        try { readProfile(); } catch (e) { }
        try { readComplications(); } catch (e) { }
        try { readWeather(); } catch (e) { }
        if (force || _lastHist < 0 || (mins - _lastHist).abs() >= 5) {
            _lastHist = mins;
            try { readHistory(); } catch (e) { }
        }
        try { readWeek(); } catch (e) { }
        try { readAstro(); } catch (e) { }
        try { buildSlots(); } catch (e) { }
        return true;
    }

    hidden function readDate() as Void {
        var now = Time.now();
        unix = now.value();
        var g = Gregorian.info(now, Time.FORMAT_SHORT);
        day = g.day; mon = g.month as Number; year = g.year;
        dow = (g.day_of_week as Number) - 1;
        dowStr = DOW[dow];
        monStr = MON[mon - 1];
        doy = dayOfYear(year, mon, day);
        wk = isoWeek(year, doy, dow);
    }

    static function leap(y) as Boolean {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    static function dayOfYear(y, mo, dd) as Number {
        var cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var n = cum[mo - 1] + dd;
        if (mo > 2 && leap(y)) { n += 1; }
        return n;
    }

    static function isoWeek(y, yd, wd) as Number {
        var iso = wd == 0 ? 7 : wd;
        var w = (yd - iso + 10) / 7;
        if (w < 1) {
            var py = y - 1;
            var pyd = leap(py) ? 366 : 365;
            return isoWeek(py, yd + pyd, wd);
        }
        var ydays = leap(y) ? 366 : 365;
        if (w == 53 && (ydays - yd) < (4 - iso)) {
            return 1;
        }
        return w;
    }

    hidden function readDevice() as Void {
        var ds = System.getDeviceSettings();
        is24 = ds.is24Hour;
        notif = ds.notificationCount;
        phone = ds.phoneConnected;
        dnd = ds.doNotDisturb;
        alarms = ds.alarmCount;
        metric = ds.distanceUnits != System.UNIT_STATUTE;
        var st = System.getSystemStats();
        batt = st.battery.toNumber();
        charging = st.charging;
        if (st has :batteryInDays && st.batteryInDays != null) {
            battDays = st.batteryInDays.toNumber();
        }
    }

    hidden function readActivity() as Void {
        var ai = ActivityMonitor.getInfo();
        steps = nz(ai.steps, 0);
        stepGoal = nz(ai.stepGoal, 10000);
        floors = nz(ai.floorsClimbed, 0);
        floorsGoal = nz(ai.floorsClimbedGoal, 10);
        kcal = nz(ai.calories, 0);
        distM = nz(ai.distance, 0) / 100;
        if (ai.activeMinutesWeek != null) {
            imWeek = nz(ai.activeMinutesWeek.total, 0);
        }
        imGoal = nz(ai.activeMinutesWeekGoal, 150);
        if (ai has :respirationRate && ai.respirationRate != null) {
            resp = ai.respirationRate;
        }
        if (ai has :stressScore && ai.stressScore != null) {
            stress = ai.stressScore;
        }
        // floors this week (ISO week, Monday start) = history + today
        var fw = floors;
        var hist = ActivityMonitor.getHistory();
        var back = dow == 0 ? 6 : dow - 1; // days since Monday
        if (hist != null) {
            for (var i = 0; i < hist.size() && i < back; i++) {
                fw += nz(hist[i].floorsClimbed, 0);
            }
        }
        floorsWeek = fw;
        var act = Activity.getActivityInfo();
        if (act != null && act.currentHeartRate != null) {
            hr = act.currentHeartRate;
        } else {
            var it = ActivityMonitor.getHeartRateHistory(1, true);
            var smp = it.next();
            if (smp != null && smp.heartRate != ActivityMonitor.INVALID_HR_SAMPLE) {
                hr = smp.heartRate;
            }
        }
    }

    // Live heart rate for designs that show it ticking (LIVE): re-reads the sensor at most once per
    // second (cheap), falls back to the minute value. Only called by the designs that need it.
    function hrNow() as Number {
        if (s != _hrSec) {
            _hrSec = s;
            _hrLive = hr;
            try {
                var act = Activity.getActivityInfo();
                if (act != null && act.currentHeartRate != null) {
                    _hrLive = act.currentHeartRate as Number;
                }
            } catch (e) {
            }
        }
        return _hrLive;
    }

    // Called once per wrist raise / face shown. Persists today's glance count.
    function countGlance() as Void {
        try {
            var g = Application.Storage.getValue("gl") as Array?;
            if (g == null || g.size() < 3) {
                g = [doy, 0, 0];
            }
            if (g[0] != doy) {
                g[0] = doy;
                g[1] = 0;
            }
            g[1] = g[1] + 1;
            g[2] = g[2] + 1;
            Application.Storage.setValue("gl", g);
            glances = g[1];
            wakeN = g[2];
        } catch (e) {
        }
    }

    // Week view + training-day detection. A day counts as a training day when it has
    // >= 30 active minutes, or when the weekly bike/run distance grew by > 1 km that day.
    hidden function readWeek() as Void {
        dayGoal = cfg.dayGoal;
        src = cfg.src;
        dayIdx = dow == 0 ? 6 : dow - 1;
        var st = [-1, -1, -1, -1, -1, -1, -1];
        var fl = [-1, -1, -1, -1, -1, -1, -1];
        var ac = [-1, -1, -1, -1, -1, -1, -1];
        var ai = ActivityMonitor.getInfo();
        st[dayIdx] = steps;
        fl[dayIdx] = floors;
        ac[dayIdx] = (ai.activeMinutesDay != null) ? nz(ai.activeMinutesDay.total, 0) : 0;
        var hist = ActivityMonitor.getHistory();
        if (hist != null) {
            for (var i = 0; i < hist.size() && i < dayIdx; i++) {
                var k = dayIdx - 1 - i;
                st[k] = nz(hist[i].steps, 0);
                fl[k] = nz(hist[i].floorsClimbed, 0);
                ac[k] = hist[i].activeMinutes != null ? nz(hist[i].activeMinutes.total, 0) : 0;
            }
        }
        wkSteps = st;
        wkFloors = fl;
        wkAct = ac;
        var mask = 0;
        for (var j = 0; j <= dayIdx; j++) {
            if (ac[j] >= 30) {
                mask |= (1 << j);
            }
        }
        // remember distance-based training days across the week
        var key = year * 100 + wk;
        var tw = Application.Storage.getValue("tw") as Array?;
        if (tw == null || tw.size() < 5 || tw[0] != key) {
            tw = [key, 0, -1, 0, 0];
        }
        var old = tw[1];
        var dirty = false;
        if (tw[2] != doy) {
            dirty = true;
            tw[2] = doy;
            tw[3] = wkBike < 0 ? 0 : wkBike;
            tw[4] = wkRun < 0 ? 0 : wkRun;
        }
        if ((wkBike >= 0 && wkBike - tw[3] > 1000) || (wkRun >= 0 && wkRun - tw[4] > 1000)) {
            tw[1] = tw[1] | (1 << dayIdx);
        }
        mask |= tw[1];
        if (dirty || tw[1] != old) {
            Application.Storage.setValue("tw", tw);
        }
        trainMask = mask;
        var n = 0;
        for (var b = 0; b < 7; b++) {
            if ((mask & (1 << b)) != 0) {
                n++;
            }
        }
        trainDays = n;
    }

    hidden function readProfile() as Void {
        var p = UserProfile.getProfile();
        if (p.restingHeartRate != null) { rhr = p.restingHeartRate; }
        if (p.vo2maxCycling != null) { vo2b = p.vo2maxCycling; }
        if (p.vo2maxRunning != null) { vo2r = p.vo2maxRunning; }
        var zones = UserProfile.getHeartRateZones(UserProfile.HR_ZONE_SPORT_GENERIC);
        if (zones != null && zones.size() > 5) {
            hrMax = zones[5];
        } else if (p.birthYear != null) {
            hrMax = 220 - (year - p.birthYear);
        }
    }

    // value of a system complication or null
    static function cv(type as Number) {
        try {
            var c = Complications.getComplication(new Complications.Id(type as Complications.Type));
            return c.value;
        } catch (e) {
            return null;
        }
    }

    hidden function readComplications() as Void {
        if (!(Toybox has :Complications)) {
            return;
        }
        var v;
        v = cv(23); if (v != null) { bb = v.toNumber(); }
        v = cv(22); if (v != null) { stress = v.toNumber(); }
        v = cv(21); if (v != null) { recov = v.toNumber(); }
        v = cv(25); if (v != null) { vo2b = v.toNumber(); }
        v = cv(24); if (v != null) { vo2r = v.toNumber(); }
        v = cv(20); if (v != null) { wkBike = v.toNumber(); }
        v = cv(19); if (v != null) { wkRun = v.toNumber(); }
        v = cv(26); if (v != null) { tStatus = v.toString(); }
        v = cv(27); if (v != null) { p5k = v.toNumber(); }
        v = cv(28); if (v != null) { p10k = v.toNumber(); }
        v = cv(29); if (v != null) { pHM = v.toNumber(); }
        v = cv(30); if (v != null) { pM = v.toNumber(); }
        v = cv(35); if (v != null) { spo2 = v.toNumber(); }
        v = cv(36); if (v != null) { resp = v.toNumber(); }
        v = cv(42); if (v != null) { sleep = v.toNumber(); }
        v = cv(15); if (v != null) { alt = v.toNumber(); }
        v = cv(16); if (v != null) { pres = v.toNumber(); }
        v = cv(38); if (v != null) { temp = v.toNumber(); }
        v = cv(18); if (v != null && hr < 0) { hr = v.toNumber(); }
        v = cv(12); nextEv = v != null ? clockMins(v.toString()) : -1;
    }

    // "14:00", "2:00 PM" -> minutes since midnight, -1 if there is no time in it
    static function clockMins(s as String) as Number {
        var c = s.toCharArray();
        var i = s.find(":");
        if (i == null || i < 1 || i + 2 >= c.size()) {
            return -1;
        }
        var h = 0;
        var f = 1;
        for (var k = i - 1; k >= 0 && k >= i - 2 && c[k] >= '0' && c[k] <= '9'; k--) {
            h += (c[k].toNumber() - 48) * f;
            f *= 10;
        }
        var m = (c[i + 1].toNumber() - 48) * 10 + (c[i + 2].toNumber() - 48);
        var u = s.toUpper();
        if (u.find("PM") != null && h < 12) {
            h += 12;
        } else if (u.find("AM") != null && h == 12) {
            h = 0;
        }
        return h * 60 + m;
    }

    hidden function readWeather() as Void {
        if (!(Toybox has :Weather)) {
            return;
        }
        var w = Weather.getCurrentConditions();
        if (w == null) {
            loadLoc();
            return;
        }
        if (w.temperature != null) { temp = w.temperature.toNumber(); }
        if (w.condition != null) { cond = w.condition; }
        if (w.windSpeed != null) { wind = w.windSpeed; }
        if (w.windBearing != null) { windDeg = w.windBearing; }
        if (w.precipitationChance != null) { rain = w.precipitationChance; }
        if (w.highTemperature != null) { hiT = w.highTemperature.toNumber(); }
        if (w.lowTemperature != null) { loT = w.lowTemperature.toNumber(); }
        var pos = w.observationLocationPosition;
        if (pos != null) {
            var deg = pos.toDegrees();
            lat = deg[0].toFloat();
            lon = deg[1].toFloat();
            locOk = true;
            try {
                Application.Storage.setValue("loc", [lat, lon]);
            } catch (e) {
            }
        } else {
            loadLoc();
        }
    }

    hidden function loadLoc() as Void {
        if (locOk) {
            return;
        }
        var l = Application.Storage.getValue("loc") as Array?;
        if (l != null && l.size() == 2) {
            lat = l[0]; lon = l[1]; locOk = true;
        }
    }

    // Bucket a SensorHistory iterator into n slots across `period` seconds (oldest first).
    static function bucket(it, n as Number, period as Number, nowSec as Number) as Array<Number> {
        var sum = new [n];
        var cnt = new [n];
        for (var i = 0; i < n; i++) { sum[i] = 0; cnt[i] = 0; }
        if (it != null) {
            var smp = it.next();
            var guard = 0;
            while (smp != null && guard < 2000) {
                guard++;
                if (smp.data != null && smp.when != null) {
                    var age = nowSec - smp.when.value();
                    var idx = n - 1 - (age * n / period);
                    if (idx >= 0 && idx < n) {
                        sum[idx] += smp.data.toNumber();
                        cnt[idx] += 1;
                    }
                }
                smp = it.next();
            }
        }
        var out = new [n] as Array<Number>;
        var last = -1;
        for (var i = 0; i < n; i++) {
            if (cnt[i] > 0) {
                last = sum[i] / cnt[i];
            }
            out[i] = last;
        }
        return out;
    }

    hidden function readHistory() as Void {
        if (!(Toybox has :SensorHistory)) {
            return;
        }
        var nowSec = Time.now().value();
        if (SensorHistory has :getHeartRateHistory) {
            hrHist = bucket(SensorHistory.getHeartRateHistory({:period => new Time.Duration(7200), :order => SensorHistory.ORDER_OLDEST_FIRST}), 60, 7200, nowSec);
        }
        if (SensorHistory has :getBodyBatteryHistory) {
            bbHist = bucket(SensorHistory.getBodyBatteryHistory({:period => new Time.Duration(86400), :order => SensorHistory.ORDER_OLDEST_FIRST}), 48, 86400, nowSec);
            if (bb < 0 && bbHist.size() > 0) { bb = bbHist[bbHist.size() - 1]; }
        }
        if (SensorHistory has :getStressHistory) {
            stressHist = bucket(SensorHistory.getStressHistory({:period => new Time.Duration(86400), :order => SensorHistory.ORDER_OLDEST_FIRST}), 48, 86400, nowSec);
            if (stress < 0 && stressHist.size() > 0) { stress = stressHist[stressHist.size() - 1]; }
        }
    }

    hidden function readAstro() as Void {
        sunrise = AST.cross(doy, lat, lon, tz, -0.833, true);
        sunset = AST.cross(doy, lat, lon, tz, -0.833, false);
        moon = AST.moon(unix);
    }

    hidden function rawFor(t as Number) {
        switch (t) {
            case 1: return batt;
            case 2: return steps;
            case 3: return kcal;
            case 4: return floors;
            case 5: return imWeek;
            case 13: return sunrise < 0 ? -1 : (sunrise * 60).toNumber();
            case 14: return sunset < 0 ? -1 : (sunset * 60).toNumber();
            case 15: return alt;
            case 16: return pres;
            case 17: return notif;
            case 18: return hr;
            case 19: return wkRun;
            case 20: return wkBike;
            case 21: return recov;
            case 22: return stress;
            case 23: return bb;
            case 24: return vo2r;
            case 25: return vo2b;
            case 26: return tStatus.length() > 0 ? tStatus : -1;
            case 27: return p5k;
            case 28: return p10k;
            case 29: return pHM;
            case 30: return pM;
            case 35: return spo2;
            case 36: return resp;
            case 38: return temp == -99 ? -1 : temp;
            case 42: return sleep;
        }
        return -1;
    }

    hidden function buildSlots() as Void {
        var out = [] as Array<Dictionary>;
        for (var i = 0; i < 3; i++) {
            var t = cfg.slots[i];
            out.add(fmtSlot(t, rawFor(t), metric));
        }
        slots = out;
    }

    static function label(t as Number) as String {
        switch (t) {
            case 23: return "B-BATT";
            case 21: return "ERHOLUNG";
            case 20: return "RAD/WO";
            case 19: return "LAUF/WO";
            case 25: return "VO2 RAD";
            case 24: return "VO2 LAUF";
            case 42: return "SCHLAF";
            case 22: return "STRESS";
            case 18: return "PULS";
            case 36: return "ATMUNG";
            case 35: return "SPO2";
            case 2: return "SCHRITTE";
            case 4: return "ETAGEN";
            case 5: return "INT-MIN";
            case 3: return "KCAL";
            case 1: return "AKKU";
            case 38: return "TEMP";
            case 15: return "HÖHE";
            case 16: return "DRUCK";
            case 13: return "AUFGANG";
            case 14: return "UNTERG.";
            case 17: return "NACHR.";
            case 26: return "STATUS";
            case 27: return "5K";
            case 28: return "10K";
            case 29: return "HM";
            case 30: return "M";
        }
        return "--";
    }

    // Mirrors fmtSlot() in model.js
    // An empty slot (type 0) has lbl "" and val "": faces skip it.
    static function fmtSlot(t as Number, raw, metric as Boolean) as Dictionary {
        if (t == 0) {
            return {:lbl => "", :val => "", :raw => -1};
        }
        var lbl = label(t);
        if (raw == null || (raw instanceof Number && raw == -1)) {
            return {:lbl => lbl, :val => "--", :raw => -1};
        }
        var val;
        switch (t) {
            case 21:
                val = raw >= 60 ? Math.round(raw / 60.0).toNumber() + "H" : raw + "M";
                break;
            case 19:
            case 20: {
                var km = metric ? raw / 1000.0 : raw / 1609.344;
                val = km >= 100 ? Math.round(km).toNumber().toString() : km.format("%.1f");
                break;
            }
            case 2:
            case 3:
                val = G.num(raw);
                break;
            case 15:
                val = Math.round(metric ? raw : raw * 3.28084).toNumber().toString();
                break;
            case 16:
                val = Math.round(raw / 100.0).toNumber().toString();
                break;
            case 13:
            case 14:
                val = G.pad2(raw / 3600) + ":" + G.pad2((raw % 3600) / 60);
                break;
            case 38:
                val = Math.round(metric ? raw : raw * 1.8 + 32).toNumber() + "°";
                break;
            case 27:
            case 28:
            case 29:
            case 30:
                val = G.race(raw);
                break;
            case 26:
                val = raw.toString().toUpper();
                break;
            case 1:
            case 35:
                val = Math.round(raw).toNumber() + "%";
                break;
            default:
                val = Math.round(raw).toNumber().toString();
        }
        return {:lbl => lbl, :val => val, :raw => raw};
    }

    static function nz(v, def) {
        return v == null ? def : v;
    }
}
