# FaceLab – Watchface-Studio für die Forerunner 970

FaceLab ist ein Studio für eigene Garmin-Watchfaces: eine Website mit 40 fertigen Designs, die du live
ansehen, anpassen und als installierbares Watchface (`.prg`) herunterladen kannst – direkt im Browser,
ohne SDK, ohne Konto, ohne Connect IQ Store.

<p align="center"><img src="docs/media/studio.webp" alt="FaceLab-Studio" width="100%"></p>

## Schnellstart

1. **Studio öffnen:** `site/FaceLab.html` im Browser öffnen (Doppelklick genügt, funktioniert offline).
   Die Datei entsteht mit `node tools/bundle.mjs` (siehe unten) oder als Artefakt der GitHub Action.
2. Design wählen, Variante/Farben/Datenfelder einstellen.
3. Uhr per USB anschließen und auf **„Direkt auf die Uhr übertragen (USB)“** klicken (Chrome, Edge oder
   Brave; WebUSB, kein Zusatzprogramm nötig), Forerunner im Dialog wählen, Uhr trennen.
   Ohne Chromium-Browser: **„Watchface erzeugen (.zip)“**, ZIP entpacken und die `.prg` mit
   [OpenMTP](https://openmtp.ganeshrvel.com/) nach `GARMIN/APPS` kopieren.
4. Auf der Uhr: Watchface lange drücken → Watchface wählen → dein neues Design.

Der Name bestimmt den Platz auf der Uhr: Mit gleichem Namen neu erzeugen und die Datei ersetzen
aktualisiert das Watchface; ein neuer Name legt ein zusätzliches an. So kannst du mehrere Varianten
gleichzeitig auf der Uhr haben.

## Die Designs

Alle 40 Designs auf einen Blick (gerendert mit derselben Engine wie die Vorschau im Studio):

<p align="center"><img src="docs/media/overview.webp" alt="Alle 40 Designs" width="100%"></p>

Die Animationen zeigen, was beim Handgelenk-Heben passiert: Intro und die ersten Sekunden der laufenden Animation.

### Klassisch

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/MONO.webp" width="180" alt="Mono"><br><b>Mono</b><br><sub>Riesige Monoline-Ziffern, die sich beim Handgelenk-Heben selbst schreiben</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/CHRONO.webp" width="180" alt="Chronograph"><br><b>Chronograph</b><br><sub>Analoger Chronograph mit Hilfszifferblättern und gleitendem Sekundenzeiger</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/BAHN.webp" width="180" alt="Bahnhofsuhr"><br><b>Bahnhofsuhr</b><br><sub>Roter Kellen-Sekundenzeiger: 58,5 s Umlauf, Halt bei 12, Minutensprung</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/WORT.webp" width="180" alt="Wortuhr"><br><b>Wortuhr</b><br><sub>„ES IST VIERTEL NACH ZEHN“ – deutsche Wortuhr</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/FLAP.webp" width="180" alt="Split-Flap"><br><b>Split-Flap</b><br><sub>Bahnhofs-Klapptafel, die sich durchblättert</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/NIXIE.webp" width="180" alt="Nixie"><br><b>Nixie</b><br><sub>Glühende Nixie-Röhren, die beim Heben alle Ziffern durchlaufen; Dekatron-Variante mit Sekunden-Glimmpunkt</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/SKELETT.webp" width="180" alt="Skelett"><br><b>Skelett</b><br><sub>Offenes Uhrwerk mit schwingender Unruh, Räderwerk und Tourbillon; Gangreserve = Akku</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/BAUHAUS.webp" width="180" alt="Bauhaus"><br><b>Bauhaus</b><br><sub>Kreis, Quadrat, Dreieck: Stunde und Minute als Formen, jede Minute neu komponiert (auch Mondrian, Memphis)</sub></td>
</tr>
</table>

### Rad & Training

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/ALPE.webp" width="180" alt="Alpe 21"><br><b>Alpe 21</b><br><sub>21 Kehren der Alpe d'Huez (oder Ventoux, Stelvio, Everest) – Antrieb wählbar: Höhenmeter, Rad-km-Wochenziel oder Trainingstage</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/TOUR.webp" width="180" alt="Tour de Woche"><br><b>Tour de Woche</b><br><sub>Die Woche als Rundfahrt: 7 Etappen, Gelbes (Rad-km), Grünes (Trainingstage) und Bergtrikot (Höhenmeter)</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/VELO.webp" width="180" alt="Velodrom"><br><b>Velodrom</b><br><sub>Wochen-km als Runden auf der 250-m-Bahn, Rundentafel und Zielglocke</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/HUD.webp" width="180" alt="Power HUD"><br><b>Power HUD</b><br><sub>Zwift-inspiriert: FTP, W/kg, Kategorie, Zonen in Watt, Workout des Tages</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/GEAR.webp" width="180" alt="Drivetrain"><br><b>Drivetrain</b><br><sub>Kettenblatt und Kassette als Uhr – jede Stunde ein Ritzel weiter</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/WOCHE.webp" width="180" alt="Wochenbilanz"><br><b>Wochenbilanz</b><br><sub>Heatmap der Woche, Trainingstage als Ring</sub></td>
</tr>
</table>

### Pixel-Art

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/RIDER.webp" width="180" alt="Pixel Rider"><br><b>Pixel Rider</b><br><sub>8-Bit-Sidescroller mit Parallax, echter Tag/Nacht-Himmel, Etappenziel mit Zielbanner</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/CITY.webp" width="180" alt="Pixel City"><br><b>Pixel City</b><br><sub>Skyline, in der jede erklommene Etage ein Fenster erleuchtet; S-Bahn, Regen, Schnee</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/BUDDY.webp" width="180" alt="Pixel Buddy"><br><b>Pixel Buddy</b><br><sub>Tamagotchi, das auf Body Battery, Stress, Schritte und Schlaf reagiert</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/DUNGEON.webp" width="180" alt="Dungeon"><br><b>Dungeon</b><br><sub>Täglich ein neues Monster – deine Schritte sind die Angriffe, Gold und Sieg-Serie</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/MUNCH.webp" width="180" alt="Muncher"><br><b>Muncher</b><br><sub>Arcade-Labyrinth: frisst deine Schritt-Punkte, Stress bringt Geister</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/QUEST.webp" width="180" alt="Daily Quest"><br><b>Daily Quest</b><br><sub>Drei tägliche Quests, XP, Level und Streak</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/TERM.webp" width="180" alt="Terminal"><br><b>Terminal</b><br><sub>Grüner Phosphor, Shell-Session mit deinen Körperdaten</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/BLOCK.webp" width="180" alt="Blockfall"><br><b>Blockfall</b><br><sub>Fallende Blöcke stapeln sich zur Uhrzeit, Reihen werden abgeräumt, Rekord wird gespeichert</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/AQUA.webp" width="180" alt="Aquarium"><br><b>Aquarium</b><br><sub>Riff, Koi-Teich oder Tiefsee; nachts dunkel, beim Heben kommen die Fische an die Scheibe</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/WETTER.webp" width="180" alt="Wetterfenster"><br><b>Wetterfenster</b><br><sub>Pixel-Fenster mit dem echten Wetter: Regen an der Scheibe, Schnee auf dem Sims, Katze, Postkarte, Diorama</sub></td>
</tr>
</table>

### KI, interaktiv & versteckte Uhrzeit

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/NEURO.webp" width="180" alt="Neuronetz"><br><b>Neuronetz</b><br><sub>Körperdaten als Eingänge eines neuronalen Netzes, Signale pulsieren bis zur Uhrzeit</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/SCAN.webp" width="180" alt="KI-Vision"><br><b>KI-Vision</b><br><sub>Objekterkennung: Bounding-Boxen erkennen deine Werte mit Konfidenz („STRESS 28 · 97 %“)</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/LATENT.webp" width="180" alt="Latent"><br><b>Latent</b><br><sub>Bei jedem Handgelenk-Heben entsteht die Uhrzeit wie bei einem Bildgenerator aus Rauschen – jedes Mal mit neuem Seed</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/COACH.webp" width="180" alt="KI-Coach"><br><b>KI-Coach</b><br><sub>Chat mit deinem Coach: bei jedem Blick eine neue Nachricht aus Body Battery, Schlaf, Erholung, Wochenziel</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/ORAKEL.webp" width="180" alt="KI-Orakel"><br><b>KI-Orakel</b><br><sub>Orakel-Kugel, die bei jedem Heben eine Frage zu deinem Tag beantwortet</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/BLICK.webp" width="180" alt="Blick-Zähler"><br><b>Blick-Zähler</b><br><sub>Zählt, wie oft du heute auf die Uhr schaust: Abzeichen, Vergleich mit gestern</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/CIPHER.webp" width="180" alt="Geheimcode"><br><b>Geheimcode</b><br><sub>Uhrzeit binär, als Morsecode oder römisch – nach ein paar Sekunden entschlüsselt sie sich</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/NEBEL.webp" width="180" alt="Nebel"><br><b>Nebel</b><br><sub>Beschlagenes Display: ein Finger wischt die Uhrzeit frei, dann zieht der Nebel wieder zu</sub></td>
</tr>
</table>

### Daten-Kunst & wild

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/CORE.webp" width="180" alt="Energy Core"><br><b>Energy Core</b><br><sub>Body Battery als Flüssigkeit; Stress macht die Wellen wild</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/PULSE.webp" width="180" alt="Pulse"><br><b>Pulse</b><br><sub>2 h Herzfrequenz als Radial-Spektrum, EKG im echten Takt</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/SUN.webp" width="180" alt="Daylight"><br><b>Daylight</b><br><sub>Sonnenstand, Goldene Stunde, Rest-Tageslicht, Mondphase</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/SYNTH.webp" width="180" alt="Synthwave"><br><b>Synthwave</b><br><sub>Retro-Sonne nach echtem Sonnenstand, Gitter rast im Pulstakt</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/GLITCH.webp" width="180" alt="Glitch"><br><b>Glitch</b><br><sub>Die Uhr glitcht im Takt deines Stresslevels</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/ORBIT.webp" width="180" alt="Orbit"><br><b>Orbit</b><br><sub>Sonnensystem: Planeten für Stunde und Minute, Komet für Sekunden, echter Mond</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/LAVA.webp" width="180" alt="Lavalampe"><br><b>Lavalampe</b><br><sub>Wachsblasen steigen und verschmelzen – je wärmer es draußen ist, desto lebhafter</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/STERNE.webp" width="180" alt="Sternenhimmel"><br><b>Sternenhimmel</b><br><sub>Der echte Himmel über deinem Standort: 151 Sterne, Sternbilder, Mond in echter Phase; Polarlicht-Variante</sub></td>
</tr>
</table>

### Ein Tag im Zeitraffer

Viele Designs leben mit dem echten Tag: Sonnenstand, Dämmerung, Nacht und Mond berechnet die Uhr selbst aus Datum und Standort. So sehen sie von 0 bis 24 Uhr aus (eine Viertelstunde pro Bild):

<table>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/day/SUN.webp" width="180" alt="Daylight im Tagesverlauf"><br><b>Daylight</b><br><sub>Sonnenbogen, Dämmerung, Goldene Stunde, nachts der Mond</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/RIDER.webp" width="180" alt="Pixel Rider im Tagesverlauf"><br><b>Pixel Rider</b><br><sub>Himmel, Sonne und Sterne folgen dem echten Sonnenstand</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/STERNE.webp" width="180" alt="Sternenhimmel im Tagesverlauf"><br><b>Sternenhimmel</b><br><sub>Der Himmel dreht sich, tagsüber blau, nachts Sternbilder</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/WETTER.webp" width="180" alt="Wetterfenster im Tagesverlauf"><br><b>Wetterfenster</b><br><sub>Tag und Nacht vor dem Fenster, die Katze schläft nachts</sub></td>
</tr>
<tr>
<td align="center" valign="top" width="25%"><img src="docs/media/day/AQUA.webp" width="180" alt="Aquarium im Tagesverlauf"><br><b>Aquarium</b><br><sub>Nachts wird das Becken dunkel und die Fische leuchten</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/ORBIT.webp" width="180" alt="Orbit im Tagesverlauf"><br><b>Orbit</b><br><sub>Planeten für Stunde und Minute ziehen ihre Bahnen</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/SKELETT.webp" width="180" alt="Skelett im Tagesverlauf"><br><b>Skelett</b><br><sub>Zeiger und Räderwerk im Zeitraffer</sub></td>
<td align="center" valign="top" width="25%"><img src="docs/media/day/BUDDY.webp" width="180" alt="Pixel Buddy im Tagesverlauf"><br><b>Pixel Buddy</b><br><sub>Schläft nachts mit Mütze, wacht morgens auf</sub></td>
</tr>
</table>

<details>
<summary><b>Alle Varianten ansehen</b> (jedes Design hat drei)</summary>

**Mono**: Outline · Bold · Stack

<img src="docs/media/styles/MONO.webp" width="560" alt="Mono: Varianten">

**Chronograph**: Noir · Panda · Racing

<img src="docs/media/styles/CHRONO.webp" width="560" alt="Chronograph: Varianten">

**Bahnhofsuhr**: Klassisch · Nacht · Kelle

<img src="docs/media/styles/BAHN.webp" width="560" alt="Bahnhofsuhr: Varianten">

**Wortuhr**: Klassisch · Akzent · Neon

<img src="docs/media/styles/WORT.webp" width="560" alt="Wortuhr: Varianten">

**Split-Flap**: Bahnhof · Café · Akzent

<img src="docs/media/styles/FLAP.webp" width="560" alt="Split-Flap: Varianten">

**Nixie**: Klassisch · Eisblau · Dekatron

<img src="docs/media/styles/NIXIE.webp" width="560" alt="Nixie: Varianten">

**Skelett**: Gold · Stahl · Tourbillon

<img src="docs/media/styles/SKELETT.webp" width="560" alt="Skelett: Varianten">

**Bauhaus**: Bauhaus · Mondrian · Memphis

<img src="docs/media/styles/BAUHAUS.webp" width="560" alt="Bauhaus: Varianten">

**Alpe 21**: Serpentinen · Nacht · Profil

<img src="docs/media/styles/ALPE.webp" width="560" alt="Alpe 21: Varianten">

**Tour de Woche**: Maillot · Klassik · Nacht

<img src="docs/media/styles/TOUR.webp" width="560" alt="Tour de Woche: Varianten">

**Velodrom**: Holz · Nacht · Neon

<img src="docs/media/styles/VELO.webp" width="560" alt="Velodrom: Varianten">

**Power HUD**: Watopia · Carbon · Neon

<img src="docs/media/styles/HUD.webp" width="560" alt="Power HUD: Varianten">

**Drivetrain**: Carbon · Chrom · Neon

<img src="docs/media/styles/GEAR.webp" width="560" alt="Drivetrain: Varianten">

**Wochenbilanz**: Heatmap · Balken · Pixel

<img src="docs/media/styles/WOCHE.webp" width="560" alt="Wochenbilanz: Varianten">

**Pixel Rider**: Tag & Nacht · Gameboy · Neon

<img src="docs/media/styles/RIDER.webp" width="560" alt="Pixel Rider: Varianten">

**Pixel City**: Neon-Nacht · Retro · Winter

<img src="docs/media/styles/CITY.webp" width="560" alt="Pixel City: Varianten">

**Pixel Buddy**: Klassik · Gameboy · Pastell

<img src="docs/media/styles/BUDDY.webp" width="560" alt="Pixel Buddy: Varianten">

**Dungeon**: Verlies · Wald · Lava

<img src="docs/media/styles/DUNGEON.webp" width="560" alt="Dungeon: Varianten">

**Muncher**: Arcade · Gameboy · Neon

<img src="docs/media/styles/MUNCH.webp" width="560" alt="Muncher: Varianten">

**Daily Quest**: Pixel · Clean · Neon

<img src="docs/media/styles/QUEST.webp" width="560" alt="Daily Quest: Varianten">

**Terminal**: Phosphor · Amber · Matrix

<img src="docs/media/styles/TERM.webp" width="560" alt="Terminal: Varianten">

**Blockfall**: Klassik · Gameboy · Neon

<img src="docs/media/styles/BLOCK.webp" width="560" alt="Blockfall: Varianten">

**Aquarium**: Riff · Teich · Tiefsee

<img src="docs/media/styles/AQUA.webp" width="560" alt="Aquarium: Varianten">

**Wetterfenster**: Fenster · Postkarte · Diorama

<img src="docs/media/styles/WETTER.webp" width="560" alt="Wetterfenster: Varianten">

**Neuronetz**: Synapse · Schaltplan · Bio

<img src="docs/media/styles/NEURO.webp" width="560" alt="Neuronetz: Varianten">

**KI-Vision**: Terminator · Clean · Thermal

<img src="docs/media/styles/SCAN.webp" width="560" alt="KI-Vision: Varianten">

**Latent**: Diffusion · Pixel · Aquarell

<img src="docs/media/styles/LATENT.webp" width="560" alt="Latent: Varianten">

**KI-Coach**: Messenger · Terminal · Glas

<img src="docs/media/styles/COACH.webp" width="560" alt="KI-Coach: Varianten">

**KI-Orakel**: Kristall · Nebula · 8-Bit

<img src="docs/media/styles/ORAKEL.webp" width="560" alt="KI-Orakel: Varianten">

**Blick-Zähler**: Auge · Pixel · Minimal

<img src="docs/media/styles/BLICK.webp" width="560" alt="Blick-Zähler: Varianten">

**Geheimcode**: Binär · Morse · Römisch

<img src="docs/media/styles/CIPHER.webp" width="560" alt="Geheimcode: Varianten">

**Nebel**: Beschlagen · Frost · Rauch

<img src="docs/media/styles/NEBEL.webp" width="560" alt="Nebel: Varianten">

**Energy Core**: Plasma · Ozean · Lava

<img src="docs/media/styles/CORE.webp" width="560" alt="Energy Core: Varianten">

**Pulse**: Monitor · Zonen · Akzent

<img src="docs/media/styles/PULSE.webp" width="560" alt="Pulse: Varianten">

**Daylight**: Himmel · Linie · 24h

<img src="docs/media/styles/SUN.webp" width="560" alt="Daylight: Varianten">

**Synthwave**: Outrun · Sunset · Vapor

<img src="docs/media/styles/SYNTH.webp" width="560" alt="Synthwave: Varianten">

**Glitch**: RGB · Vaporwave · Mono

<img src="docs/media/styles/GLITCH.webp" width="560" alt="Glitch: Varianten">

**Orbit**: Kosmos · Blueprint · Eclipse

<img src="docs/media/styles/ORBIT.webp" width="560" alt="Orbit: Varianten">

**Lavalampe**: Retro · Ozean · Plasma

<img src="docs/media/styles/LAVA.webp" width="560" alt="Lavalampe: Varianten">

**Sternenhimmel**: Planetarium · Sternkarte · Polarlicht

<img src="docs/media/styles/STERNE.webp" width="560" alt="Sternenhimmel: Varianten">

</details>

**Trainingstage** erkennt FaceLab selbst: Ein Tag zählt, wenn er mindestens 30 Aktivminuten hat oder
die Wochen-Rad-/Lauf-Distanz an diesem Tag um mehr als 1 km gewachsen ist.

**Interaktion:** Garmin gibt Watchfaces keine normalen Touch-Eingaben (Antippen geht nur im
Watchface-Editor). Die interaktiven Designs reagieren deshalb auf das **Handgelenk-Heben**: Jeder Blick
zählt, erzeugt eine neue Antwort, einen neuen Seed oder eine neue Wisch-Geste. Auf Geräten, die
langes Drücken an das Watchface weiterreichen, liefern KI-Coach und KI-Orakel damit zusätzlich eine
neue Nachricht und Geheimcode entschlüsselt sich erneut (im Simulator nicht prüfbar).

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
tools/          Build, Schrift-Generator, Bundler, Simulator-Helfer, README-Medien
docs/media/     Animationen und Bilder für diese README (`node tools/media.mjs`)
site/           gebündeltes Studio (eine HTML-Datei)
```

* **Ein Code, zwei Welten:** Jedes Design existiert als JavaScript (Vorschau) und als Monkey C (Uhr) mit
  identischer Logik. Die Vorschau zeichnet über eine Nachbildung der Garmin-`Dc`-API, und alle Texte
  laufen über eigene, prozedurale Schriften (Vektor, 5×7-Pixel, 7-Segment) – dadurch sieht die
  Vorschau aus wie die Uhr.
* **Ein Design pro Watchface:** Watchfaces haben auf der FR970 nur 128 KB Speicher. Jedes Design wird
  deshalb als eigenes schlankes Watchface gebaut (Engine + ein Design: 46–84 KB im Simulator gemessen).
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

Die GitHub Action `.github/workflows/build.yml` baut bei jedem Push und Pull Request alle Watchfaces und das
Studio. Bei Pushes auf `main` stellt sie beides 14 Tage lang als Artefakt bereit. Manuell gestartet („Run workflow“) nimmt sie optional einen Face-Code
entgegen und liefert genau dieses Watchface.

Neue Designs: siehe [`docs/FACE_GUIDE.md`](docs/FACE_GUIDE.md).
