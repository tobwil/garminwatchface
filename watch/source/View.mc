import Toybox.Application;
import Toybox.Application.WatchFaceConfig;
import Toybox.Complications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// The single WatchFace view. Owns data, config, the active design and the
// animation clock. Animations run only in high-power mode (after a wrist
// raise): a Timer drives requestUpdate() at up to 20 fps.
class FaceView extends WatchUi.WatchFace {
    const INTRO_MS = 1400;
    const REVEAL = 0.4;    // share of the intro that reveals the cached static layer
    const MAX_ANIM_MS = 12000;
    const TAP_MS = 5000;   // frames keep running this long after a tap (reveals, games)

    var cfg as Cfg;
    var d as D;
    var face as Face;
    var a as A;
    hidden var _sleeping = false;
    hidden var _burnIn = false;
    hidden var _timer as Timer.Timer?;
    hidden var _wake = 0;
    hidden var _period = 0;
    hidden var _edit = false;
    hidden var _lastSec = -1;
    hidden var _tapAt = -1;
    hidden var _secAt = 0;
    hidden var _dt = 0;          // smoothed draw time per frame (ms)
    hidden var _bg = null;       // BufferedBitmapReference of the static layer
    hidden var _bgKey = -1;
    hidden var _bgFail = false;
    hidden var _bgMs = -1;       // debug: time of the last static layer render
    hidden var _card = 0;        // assistant card shown after this raise (Assist.mc), 0 = none

    function initialize(editMode as Boolean) {
        WatchFace.initialize();
        _edit = editMode;
        cfg = new Cfg();
        cfg.load();
        d = new D(cfg);
        a = new A();
        face = Registry.make();
        var ds = System.getDeviceSettings();
        _burnIn = (ds has :requiresBurnInProtection) && ds.requiresBurnInProtection;
    }

    function onLayout(dc as Dc) as Void {
        subscribe();
    }

    hidden function subscribe() as Void {
        if (!(Toybox has :Complications) || _edit) {
            return;
        }
        // register the change callback BEFORE subscribing: an update that arrives with no
        // callback registered makes the system fail invoking it ("Symbol Not Found")
        try {
            Complications.registerComplicationChangeCallback(method(:onComplicationChanged));
        } catch (e) {
            return;
        }
        var types = [23, 22, 21, 25, 24, 20, 19, 26, 27, 28, 29, 30, 35, 36, 42, 15, 16, 38, 18];
        for (var i = 0; i < types.size(); i++) {
            try {
                Complications.subscribeToUpdates(new Complications.Id(types[i] as Complications.Type));
            } catch (e) {
            }
        }
    }

    // A subscribed complication changed: values are re-read on the next minute refresh.
    function onComplicationChanged(id as Complications.Id) as Void {
    }

    function onShow() as Void {
        d.refresh(true);
        if (!_edit) {
            d.countGlance();
        }
        wake();
    }

    function onHide() as Void {
        stopTimer();
    }

    function onExitSleep() as Void {
        _sleeping = false;
        d.refresh(true);
        d.countGlance();
        wake();
    }

    function onEnterSleep() as Void {
        _sleeping = true;
        stopTimer();
        WatchUi.requestUpdate();
    }

    function onSettingsChanged() as Void {
        _bgKey = -1;
        cfg.load();
        d.refresh(true);
        wake();
    }

    function onConfigEdited() as Void {
        _bgKey = -1;
        cfg.syncNative(true);
        d.refresh(true);
        WatchUi.requestUpdate();
    }

    // ------------------------------------------------------------ animation
    hidden function wake() as Void {
        _wake = System.getTimer();
        // the assistant decides on every raise whether it has something to say
        // (not over designs that speak for themselves, and then it remembers nothing as shown)
        _card = !_sleeping && !_edit && !face.speaks() ? Assist.pick(d) : 0;
        if (cfg.anim > 0 && !_sleeping && !_edit) {
            startTimer(period(20));
        }
        WatchUi.requestUpdate();
    }

    hidden function startTimer(ms as Number) as Void {
        // small changes of the adaptive period are not worth restarting the timer
        if (_timer != null && (ms - _period).abs() < 20) {
            return;
        }
        stopTimer();
        try {
            _timer = new Timer.Timer();
            _timer.start(method(:onTick), ms, true);
            _period = ms;
        } catch (e) {
            _timer = null;
        }
    }

    // half height of the reveal band for reveal progress r (0..1)
    hidden function band(r) as Number {
        var h = Math.round(227 * r).toNumber();
        return h < 2 ? 2 : h;
    }

    // Frame period for the wanted fps, but never faster than the watch can draw: a frame
    // that is requested before the previous one is done only queues up and stutters.
    hidden function period(fps as Number) as Number {
        var ms = 1000 / fps;
        var need = _dt * 5 / 4 + 15;
        if (need > ms) {
            ms = need;
        }
        return (ms + 9) / 10 * 10;
    }

    // Key of the static layer for the current data and settings.
    hidden function layerKey() as Number {
        return face.bgKey(d) * 31 + cfg.style * 7 + cfg.accent + cfg.dcol * 3 + (d.metric ? 1 : 0);
    }

    // True if the cached static layer is rendered for key (and was not purged).
    hidden function layerReady(key as Number) as Boolean {
        if (_bg == null || key != _bgKey) {
            return false;
        }
        return (_bg as Graphics.BufferedBitmapReference).get() != null;
    }

    // Renders the static layer into the cached bitmap when its key changed.
    // Returns false if no bitmap is available (then draw() paints everything).
    hidden function staticLayer(key as Number) as Boolean {
        if (_bgFail) {
            return false;
        }
        try {
            var b = null;
            if (_bg != null) {
                b = (_bg as Graphics.BufferedBitmapReference).get();
            }
            if (b == null) {
                // (re)created, e.g. after the system purged the graphics pool
                var tc = System.getTimer();
                _bg = Graphics.createBufferedBitmap({:width => 454, :height => 454});
                if (Registry.DEBUG) {
                    System.println("bg alloc " + (System.getTimer() - tc));
                }
                b = (_bg as Graphics.BufferedBitmapReference).get();
                _bgKey = -1;
                if (b == null) {
                    _bgFail = true;
                    return false;
                }
            }
            if (key != _bgKey) {
                var bdc = (b as Graphics.BufferedBitmap).getDc();
                bdc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
                bdc.clear();
                bdc.setAntiAlias(face.aa());
                var tr = System.getTimer();
                face.bg(bdc, d);
                _bgKey = key;
                _bgMs = System.getTimer() - tr;
                if (Registry.DEBUG) {
                    System.println("bg draw " + _bgMs);
                }
            }
            return true;
        } catch (e) {
            _bgFail = true;
            return false;
        }
    }

    hidden function stopTimer() as Void {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        _period = 0;
    }

    function onTick() as Void {
        // slow data reads run here, in their own callback, so a heavy frame and the
        // once-a-minute refresh never share one watchdog budget
        var slow = d.refresh(false);
        // the static layer is rendered here, in a callback of its own: in onUpdate it would share
        // one watchdog budget with the frame (heavy designs trip it). Not in the tick that already
        // did the slow minute reads; until it is ready, onUpdate paints everything.
        if (!slow && face.bgKey(d) >= 0) {
            staticLayer(layerKey());
        }
        var now = System.getTimer();
        var t = now - _wake;
        if (_tapAt >= 0 && now - _tapAt < TAP_MS) {
            startTimer(period(20));
        } else if (_card > 0 && t < Assist.DUR[_card] + 150) {
            // an assistant card is showing: keep the frames coming until it has slid away
            startTimer(period(15));
        } else if (t > INTRO_MS) {
            var fps = cfg.anim >= 2 ? face.fps() : 0;
            if (fps <= 0 || t > MAX_ANIM_MS) {
                stopTimer();
            } else {
                startTimer(period(fps));
            }
        } else {
            startTimer(period(20));
        }
        WatchUi.requestUpdate();
    }

    // ------------------------------------------------------------ drawing
    function onUpdate(dc as Dc) as Void {
        var t0 = System.getTimer();
        if (_timer != null) {
            d.clock();
        } else {
            d.refresh(false);
        }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setAntiAlias(face.aa());
        if (_sleeping && _burnIn) {
            face.aod(dc, d);
            return;
        }
        var now = System.getTimer();
        var t = now - _wake;
        if (d.s != _lastSec) {
            _lastSec = d.s;
            _secAt = now;
        }
        a.ms = now - _secAt;
        if (a.ms > 999) {
            a.ms = 999;
        }
        a.t = t;
        a.tap = _tapAt < 0 ? 999999 : now - _tapAt;
        a.live = !_sleeping && _timer != null;
        a.intro = (cfg.anim == 0 || _edit) ? 1.0 : G.clamp(t.toFloat() / INTRO_MS, 0.0, 1.0);
        // static layer from the cache; during the intro it is revealed like an old CRT switching
        // on (a band opening from the centre), which costs one partial blit per frame
        a.bg = false;
        var reveal = 1.0;
        if (face.bgKey(d) >= 0) {
            reveal = face.reveal() ? G.ease(G.clamp(a.intro / REVEAL, 0.0, 1.0)) : 1.0;
            if (reveal < 1.0) {
                // the moving layer is clipped to the band as well
                dc.setClip(0, 227 - band(reveal), 454, 2 * band(reveal));
            }
            if (layerReady(layerKey())) {
                dc.drawBitmap(0, 0, _bg as Graphics.BufferedBitmapReference);
                a.bg = true;
            }
        }
        face.draw(dc, d, a);
        if (reveal < 1.0) {
            dc.clearClip();
            var h = band(reveal);
            dc.setColor(G.dim(G.mix(0xFFFFFF, cfg.accent, 0.35), 1.0 - reveal * 0.6), -1);
            dc.fillRectangle(0, 226 - h, 454, 2);
            dc.fillRectangle(0, 226 + h, 454, 2);
        }
        if (_card > 0 && !_sleeping && t < Assist.DUR[_card]) {
            dc.clearClip();
            Assist.draw(dc, d, _card, t);
        }
        var dtNow = System.getTimer() - t0;
        _dt = (_dt * 3 + dtNow) / 4;
        if (Registry.DEBUG) {
            var ss = System.getSystemStats();
            var dt = dtNow;
            System.println("mem " + ss.usedMemory + "/" + ss.totalMemory + " t=" + t + " dt=" + dt);
            dc.setColor(0x00FF00, 0x000000);
            F.px(dc, (ss.usedMemory / 1024) + "K/" + (ss.totalMemory / 1024) + "K " + dt + "MS", 227, 400, 2, 1, 0);
            F.px(dc, "BG " + _bgMs + "MS " + (a.bg ? "CACHE" : "VOLL"), 227, 418, 2, 1, 0);
        }
    }

    // Not used on AMOLED (no partial updates); present so the callback always resolves.
    function onPartialUpdate(dc as Dc) as Void {
    }

    function onTap(x as Number, y as Number) as Boolean {
        if (face.tap(x, y, d)) {
            _tapAt = System.getTimer();
            _wake = _tapAt - INTRO_MS;
            startTimer(period(20));
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }
}

class FaceDelegate extends WatchUi.WatchFaceDelegate {
    hidden var _view as FaceView;

    function initialize(view as FaceView) {
        WatchFaceDelegate.initialize();
        _view = view;
    }

    function onWatchFaceConfigEdited(options as {:configId as WatchFaceConfig.Id, :type as WatchUi.WatchFaceConfigType?, :committed as Boolean}) as Void {
        _view.onConfigEdited();
    }

    function onTap(clickEvent as WatchUi.ClickEvent) as Boolean {
        var c = clickEvent.getCoordinates();
        if (Registry.DEBUG) {
            System.println("tap " + c);
        }
        return _view.onTap(c[0], c[1]);
    }

    function onPowerBudgetExceeded(powerInfo as WatchUi.WatchFacePowerInfo) as Void {
    }

    // Called by the system in the watch face editor. We draw our own highlight-free
    // layout, so no drawable is returned; implemented so the callback always exists.
    function getComplicationDrawable(complication as WatchFaceConfig.ComplicationRef) as WatchUi.Drawable or WatchUi.ComplicationDrawableRef or Null {
        return null;
    }

    function onPress(clickEvent as WatchUi.ClickEvent) as Boolean {
        // touch & hold reaches watch faces on some devices: forward it like a tap
        var c = clickEvent.getCoordinates();
        if (Registry.DEBUG) {
            System.println("press " + c);
        }
        return _view.onTap(c[0], c[1]);
    }
}
