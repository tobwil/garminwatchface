# FaceLab – Watchface-Studio für die Forerunner 970

FaceLab ist ein Studio für eigene Garmin-Watchfaces: eine Website mit 14 fertigen Designs, die du live
ansehen, anpassen und als installierbares Watchface (`.prg`) herunterladen kannst – direkt im Browser,
ohne SDK, ohne Konto, ohne Connect IQ Store.

## Schnellstart

1. **Studio öffnen:** `site/FaceLab.html` im Browser öffnen (Doppelklick genügt, funktioniert offline).
   Die Datei entsteht mit `node tools/bundle.mjs` (siehe unten) oder als Artefakt der GitHub Action.
2. Design wählen, Variante/Farben/Datenfelder einstellen, unten auf **„Watchface erzeugen (.zip)“**.
3. ZIP entpacken, Uhr per USB anschließen (Mac: [OpenMTP](https://openmtp.ganeshrvel.com/)),
   die `.prg`-Datei nach `GARMIN/APPS` kopieren, Uhr trennen.
4. Auf der Uhr: Watchface lange drücken → Watchface wählen → dein neues Design.

Der Name bestimmt den Platz auf der Uhr: Mit gleichem Namen neu erzeugen und die Datei ersetzen
aktualisiert das Watchface; ein neuer Name legt ein zusätzliches an. So kannst du mehrere Varianten
gleichzeitig auf der Uhr haben.

## Die Designs

| Design | Typ | Was es besonders macht |
|---|---|---|
| **Mono** | klassisch | Riesige Monoline-Ziffern, die sich beim Handgelenk-Heben selbst schreiben |
| **Chronograph** | klassisch | Analoger Chronograph mit Hilfszifferblättern und gleitendem Sekundenzeiger |
| **Bahnhofsuhr** | klassisch | Roter Kellen-Sekundenzeiger: 58,5 s Umlauf, Halt bei 12, Minutensprung |
| **Wortuhr** | klassisch | „ES IST VIERTEL NACH ZEHN“ – deutsche Wortuhr |
| **Split-Flap** | retro | Bahnhofs-Klapptafel, die sich durchblättert |
| **Alpe 21** | Rad · Challenge | 21 Kehren der Alpe d'Huez (oder Ventoux, Stelvio, Everest) – Antrieb wählbar: Höhenmeter, Rad-km-Wochenziel oder Trainingstage |
| **Tour de Woche** | Rad · Challenge | Die Woche als Rundfahrt: 7 Etappen, Gelbes (Rad-km), Grünes (Trainingstage) und Bergtrikot (Höhenmeter) |
| **Velodrom** | Rad | Wochen-km als Runden auf der 250-m-Bahn, Rundentafel und Zielglocke |
| **Power HUD** | Rad | Zwift-inspiriert: FTP, W/kg, Kategorie, Zonen in Watt, Workout des Tages |
| **Drivetrain** | Rad · wild | Kettenblatt und Kassette als Uhr – jede Stunde ein Ritzel weiter |
| **Pixel Rider** | Pixel · Rad | 8-Bit-Sidescroller mit Parallax, echter Tag/Nacht-Himmel, Etappenziel mit Zielbanner |
| **Pixel City** | Pixel · Daten | Skyline, in der jede erklommene Etage ein Fenster erleuchtet; S-Bahn, Regen, Schnee |
| **Pixel Buddy** | Pixel · wild | Tamagotchi, das auf Body Battery, Stress, Schritte und Schlaf reagiert |
| **Dungeon** | Pixel · Challenge | Täglich ein neues Monster – deine Schritte sind die Angriffe, Gold und Sieg-Serie |
| **Muncher** | Pixel · Challenge | Arcade-Labyrinth: frisst deine Schritt-Punkte, Stress bringt Geister |
| **Daily Quest** | Pixel · Challenge | Drei tägliche Quests, XP, Level und Streak |
| **Terminal** | Pixel · wild | Grüner Phosphor, Shell-Session mit deinen Körperdaten |
| **Wochenbilanz** | Daten · Challenge | Heatmap der Woche, Trainingstage als Ring |
| **Energy Core** | Daten-Kunst | Body Battery als Flüssigkeit; Stress macht die Wellen wild |
| **Pulse** | Daten-Kunst | 2 h Herzfrequenz als Radial-Spektrum, EKG im echten Takt |
| **Daylight** | Daten | Sonnenstand, Goldene Stunde, Rest-Tageslicht, Mondphase |
| **Synthwave** | wild | Retro-Sonne nach echtem Sonnenstand, Gitter rast im Pulstakt |
| **Glitch** | wild | Die Uhr glitcht im Takt deines Stresslevels |
| **Orbit** | wild | Sonnensystem: Planeten für Stunde und Minute, Komet für Sekunden, echter Mond |

**Trainingstage** erkennt FaceLab selbst: Ein Tag zählt, wenn er mindestens 30 Aktivminuten hat oder
die Wochen-Rad-/Lauf-Distanz an diesem Tag um mehr als 1 km gewachsen ist.

Alle Designs haben drei Varianten, eine Intro-Animation beim Handgelenk-Heben, teils fortlaufende
Animationen (solange die Uhr wach ist, ca. 10 s) und einen eigenen, stromsparenden Always-On-Modus
für das AMOLED-Display (Burn-in-Schutz inklusive).

## Anpassen an der Uhr

* **Watchface-Editor der Uhr** (Watchface lange drücken → Anpassen): Variante, Akzentfarbe,
  Datenfarbe und drei Datenfelder (Body Battery, Erholungszeit, Rad-km der Woche, VO2max Rad,
  Schlafscore, Rennprognosen, …).
* **Einstellungen des Watchfaces** (Menü): FTP, Gewicht, Kletterziel, Quest-Stufe,
  Rad-Wochenziel, Animation an/aus.
* **Face-Code:** Jede Konfiguration lässt sich als Code (`FL1.ALPE.1.FF6A2B…`) kopieren und im Studio
  wieder laden.

## Wie es funktioniert

```
web/            Studio (Website) + Web-Version jedes Designs (Canvas)
  js/engine/    Zeichen-Engine, die die Garmin-Grafik-API nachbildet
  js/faces/     ein Modul pro Design
  prg/          fertig kompilierte Watchfaces (Basis für den Generator)
watch/          Connect IQ Projekt (Monkey C)
  source/       Engine: Daten, Konfiguration, Animation, Always-On, Schriften
  source/faces/ ein Design pro Datei (Zeile für Zeile identisch zur Web-Version)
tools/          Build, Schrift-Generator, Bundler, Simulator-Helfer
site/           gebündeltes Studio (eine HTML-Datei)
```

* **Ein Code, zwei Welten:** Jedes Design existiert als JavaScript (Vorschau) und als Monkey C (Uhr) mit
  identischer Logik. Die Vorschau zeichnet über eine Nachbildung der Garmin-`Dc`-API, und alle Texte
  laufen über eigene, prozedurale Schriften (Vektor, 5×7-Pixel, 7-Segment) – dadurch sieht die
  Vorschau aus wie die Uhr.
* **Ein Design pro Watchface:** Watchfaces haben auf der FR970 nur 128 KB Speicher. Jedes Design wird
  deshalb als eigenes schlankes Watchface gebaut (Engine + ein Design: 44–60 KB im Simulator gemessen).
* **Generator im Browser:** Jede `.prg` enthält Platzhalter für Face-Code, Namen und App-ID. Das Studio
  setzt deine Konfiguration ein und signiert die Datei neu (RSA, SHA-1 + SHA-256, wie der Garmin-Compiler).
  Den Schlüssel erzeugt `tools/build.py` beim ersten Build lokal in `tools/keys/` (nicht im Repo);
  `tools/bundle.mjs` bettet ihn in `site/FaceLab.html` ein. Die gebündelte Studio-Datei enthält damit
  deinen Signier-Schlüssel: Behalte sie für dich und nutze für eine Veröffentlichung im Connect IQ
  Store einen separaten Schlüssel.
* **Daten:** Body Battery, Stress, Schlafscore, Erholungszeit, VO2max (Lauf/Rad), Wochen-km Rad/Lauf,
  Trainingsstatus, Rennprognosen, Atemfrequenz, SpO2 kommen über die Connect-IQ-„Complications“;
  Herzfrequenz-/Body-Battery-/Stress-Verläufe über `SensorHistory`; Sonne und Mond werden auf der Uhr
  selbst berechnet (NOAA-Formeln).

## Selbst bauen

Voraussetzungen: Java 17+, Python 3, Node 18+, [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) (Linux/macOS/Windows).

```bash
npm install                          # esbuild für das Studio
node tools/fontgen.mjs               # Schriftdaten erzeugen (Web + Uhr)
mkdir -p ~/.Garmin/ConnectIQ/Devices && cp -r tools/device/fr970 ~/.Garmin/ConnectIQ/Devices/
CIQ_SDK=/pfad/zum/sdk CIQ_RELEASE=1 python3 tools/build.py      # alle Designs → dist/*.prg
cp dist/*.prg web/prg/ && node tools/bundle.mjs                  # Studio → site/FaceLab.html
```

`tools/device/fr970/compiler.json` ist eine eigene, minimale Gerätebeschreibung, mit der der Compiler
byte-identische Ergebnisse wie mit Garmins offiziellen Gerätedateien liefert. Wer den SDK-Manager nutzt,
kann stattdessen das offizielle FR970-Gerät installieren.

Die GitHub Action `.github/workflows/build.yml` baut bei jedem Push alle Watchfaces und das Studio und
stellt sie als Artefakt bereit. Manuell gestartet („Run workflow“) nimmt sie optional einen Face-Code
entgegen und liefert genau dieses Watchface.

Neue Designs: siehe [`docs/FACE_GUIDE.md`](docs/FACE_GUIDE.md).
