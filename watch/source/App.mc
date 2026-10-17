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

    // Lifecycle callbacks the system may invoke. They are all implemented (as no-ops
    // where nothing needs to happen) so an invocation never fails with
    // "Symbol Not Found / Failed invoking" on a fresh install.
    function onStop(state as Dictionary?) as Void {
    }

    function onActive(state as Dictionary?) as Void {
    }

    function onInactive(state as Dictionary?) as Void {
    }

    function onAppInstall() as Void {
    }

    function onAppUpdate() as Void {
    }

    function onStorageChanged() as Void {
    }

    function onDeviceSettingChanged(aSymbol as Symbol, aValue as Object) as Void {
        if (_view != null) {
            _view.onSettingsChanged();
        }
    }

    function onDisplayModeChanged() as Void {
    }

    function onNightModeChanged() as Void {
    }

    function onEnhancedReadabilityModeChanged() as Void {
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
