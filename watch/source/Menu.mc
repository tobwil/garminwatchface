import Toybox.Lang;
import Toybox.WatchUi;

// On-device settings: a Menu2 listing only the options the active design uses.
module SetMenu {
    function opts(key as String) as Array {
        if (key.equals("style")) { return Registry.STYLES; }
        if (key.equals("anim")) { return ["Aus", "Nur Intro", "Voll"]; }
        if (key.equals("climb")) { return ["Alpe d'Huez", "Mont Ventoux", "Stelvio", "Everest"]; }
        if (key.equals("quest")) { return ["Locker", "Normal", "Hart"]; }
        if (key.equals("ftp")) { return range(100, 450, 10, " W"); }
        if (key.equals("kg")) { return range(45, 130, 1, " kg"); }
        if (key.equals("bike")) { return range(0, 500, 25, " km"); }
        if (key.equals("src")) { return ["Höhenmeter", "Rad-km", "Trainingstage"]; }
        if (key.equals("days")) { return range(1, 7, 1, " Tage"); }
        return [];
    }

    function range(lo as Number, hi as Number, step as Number, unit as String) as Array {
        var out = [];
        for (var v = lo; v <= hi; v += step) {
            out.add(v + unit);
        }
        return out;
    }

    function title(key as String) as String {
        if (key.equals("style")) { return "Variante"; }
        if (key.equals("anim")) { return "Animation"; }
        if (key.equals("climb")) { return "Kletterziel"; }
        if (key.equals("quest")) { return "Quest-Stufe"; }
        if (key.equals("ftp")) { return "FTP"; }
        if (key.equals("kg")) { return "Gewicht"; }
        if (key.equals("bike")) { return "Rad-Wochenziel"; }
        if (key.equals("src")) { return "Fortschritt aus"; }
        if (key.equals("days")) { return "Trainingstage-Ziel"; }
        return key;
    }

    // value <-> option index
    function getIdx(cfg as Cfg, key as String) as Number {
        if (key.equals("style")) { return cfg.style - 1; }
        if (key.equals("anim")) { return cfg.anim; }
        if (key.equals("climb")) { return cfg.climb; }
        if (key.equals("quest")) { return cfg.quest; }
        if (key.equals("ftp")) { return (cfg.ftp - 100) / 10; }
        if (key.equals("kg")) { return cfg.kg - 45; }
        if (key.equals("bike")) { return cfg.bikeGoal / 25; }
        if (key.equals("src")) { return cfg.src; }
        if (key.equals("days")) { return cfg.dayGoal - 1; }
        return 0;
    }

    function setIdx(cfg as Cfg, key as String, i as Number) as Void {
        if (key.equals("style")) { cfg.style = i + 1; }
        else if (key.equals("anim")) { cfg.anim = i; }
        else if (key.equals("climb")) { cfg.climb = i; }
        else if (key.equals("quest")) { cfg.quest = i; }
        else if (key.equals("ftp")) { cfg.ftp = 100 + i * 10; }
        else if (key.equals("kg")) { cfg.kg = 45 + i; }
        else if (key.equals("bike")) { cfg.bikeGoal = i * 25; }
        else if (key.equals("src")) { cfg.src = i; }
        else if (key.equals("days")) { cfg.dayGoal = i + 1; }
        cfg.save();
    }

    function valueLabel(cfg as Cfg, key as String) as String {
        var o = opts(key);
        var i = getIdx(cfg, key);
        return (i >= 0 && i < o.size()) ? o[i].toString() : "";
    }

    function build(cfg as Cfg) as [WatchUi.Views, WatchUi.InputDelegates] {
        var m = new WatchUi.Menu2({:title => "FaceLab"});
        var keys = Registry.USES;
        for (var i = 0; i < keys.size(); i++) {
            var k = keys[i] as String;
            m.addItem(new WatchUi.MenuItem(title(k), valueLabel(cfg, k), k, null));
        }
        return [m, new MainDelegate(cfg, m)];
    }
}

class MainDelegate extends WatchUi.Menu2InputDelegate {
    hidden var _cfg as Cfg;
    hidden var _menu as WatchUi.Menu2;

    function initialize(cfg as Cfg, menu as WatchUi.Menu2) {
        Menu2InputDelegate.initialize();
        _cfg = cfg;
        _menu = menu;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var key = item.getId() as String;
        var sub = new WatchUi.Menu2({:title => SetMenu.title(key)});
        var o = SetMenu.opts(key);
        for (var i = 0; i < o.size(); i++) {
            sub.addItem(new WatchUi.MenuItem(o[i].toString(), null, i, null));
        }
        var cur = SetMenu.getIdx(_cfg, key);
        if (cur >= 0 && cur < o.size()) {
            sub.setFocus(cur);
        }
        WatchUi.pushView(sub, new PickDelegate(_cfg, key, item), WatchUi.SLIDE_LEFT);
    }
}

class PickDelegate extends WatchUi.Menu2InputDelegate {
    hidden var _cfg as Cfg;
    hidden var _key as String;
    hidden var _parent as WatchUi.MenuItem;

    function initialize(cfg as Cfg, key as String, parent as WatchUi.MenuItem) {
        Menu2InputDelegate.initialize();
        _cfg = cfg;
        _key = key;
        _parent = parent;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        SetMenu.setIdx(_cfg, _key, item.getId() as Number);
        _parent.setSubLabel(SetMenu.valueLabel(_cfg, _key));
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
