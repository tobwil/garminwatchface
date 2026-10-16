# Entwickler-Notizen

## Werkzeuge

| Befehl | Zweck |
|---|---|
| `node tools/fontgen.mjs` | erzeugt die Schriftdaten für Web (`web/js/engine/fontdata.js`) und Uhr (`watch/source/gen/FontData.mc`) |
| `python3 tools/build.py [KEY…]` | kompiliert Watchfaces nach `dist/<KEY>.prg` (`CIQ_RELEASE=1` ohne Debug-Infos, `FL_DEBUG=1` zeigt Speicher/Renderzeit auf dem Display) |
| `node tools/shot.mjs <dir> KEY:style … [--q "t=500&live=1"]` | rendert Designs mit der Web-Engine als PNG |
| `tools/simrun.sh <prg> <out.png> [sek]` | startet die `.prg` im echten Garmin-Simulator (headless), speichert Screenshot + Konsolenausgabe |
| `node tools/bundle.mjs` | baut das Studio als Einzeldatei `site/FaceLab.html` (bettet `web/prg/*.prg` und den Schlüssel ein) |

## Headless-Simulator (optional)

`simrun.sh` erwartet eine lokale Simulator-Installation unter `/opt/ciq`:

* SDK unter `/opt/ciq/sdk` (öffentlicher Download von developer.garmin.com).
* Unter Ubuntu 24.04 fehlen dem Simulator `libwebkit2gtk-4.0`/`libsoup2.4`; die Pakete aus Ubuntu 22.04
  werden nach `/opt/ciq/jammy-libs` entpackt und nur per `LD_LIBRARY_PATH` genutzt.
* Der Simulator braucht die **offiziellen** Gerätedateien (`fr970.bin`, `simulator.json`, Fonts) aus dem
  Garmin SDK-Manager unter `~/.Garmin/ConnectIQ/`. Diese Dateien sind urheberrechtlich geschützt und
  gehören nicht ins Repo. Für das reine Kompilieren reicht `tools/device/fr970/compiler.json`.
* Bis zu drei Simulatoren laufen parallel: jeder auf eigenem Xvfb-Display (`:91`–`:93`), mit eigenem
  `$HOME` (der Simulator erlaubt nur eine Instanz pro Home) und in einem eigenen Netzwerk-Namespace
  (`unshare -n`), weil `monkeydo` über einen festen TCP-Port mit dem Simulator spricht.

## Format der .prg (für den Generator)

Abschnitte `[tag u32][len u32][daten]`. Der Generator ändert nur Bytes fester Länge:
* String-Ressource `FaceCode`: `FLCODE:` + Code, mit `#` auf 120 Bytes aufgefüllt
* String-Ressource `AppName`: Name + geschützte Leerzeichen, genau 48 UTF-8-Bytes
* App-ID (16 Bytes) im Kopfabschnitt `0xD000D00D`
* Signaturabschnitt `0xE1C0DE12` (1540 Bytes): RSA-PKCS#1-v1.5-Signatur (SHA-1, 512 B), Modulus (512 B),
  Exponent (4 B), RSA-Signatur (SHA-256, 512 B) – beide über alle Bytes vor diesem Abschnitt.
