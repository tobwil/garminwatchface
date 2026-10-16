import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class FaceLabApp extends Application.AppBase {
    hidden var _view as FaceView?;
    hidden var _edit = false;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
        if (state != null && state[:launchedFromWatchFaceSettingsEditor] == true) {
            _edit = true;
        }
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        _view = new FaceView(_edit);
        return [_view, new FaceDelegate(_view)];
    }

    function onSettingsChanged() as Void {
        if (_view != null) {
            _view.onSettingsChanged();
        }
    }

    // On-device settings (long press on the face > settings).
    function getSettingsView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] or Null {
        var cfg = _view != null ? _view.cfg : null;
        if (cfg == null) {
            cfg = new Cfg();
            cfg.load();
        }
        return SetMenu.build(cfg);
    }
}

function getApp() as FaceLabApp {
    return Application.getApp() as FaceLabApp;
}
