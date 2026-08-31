# BeachBande – Architektur-Richtlinien

Stand: 31.08.2026 · Gilt für Web (`beachbingo-web`, React/Vite/TS) und Android (`Beachbingo`, Kotlin/Compose)

**Zweck:** Dieses Dokument hält die plattformübergreifenden Regeln fest, die sich über die Analyse-Berichte 9–13 hinweg wiederholt als Fehlerquelle herausgestellt haben (Navigation, Zentralisierung, Layout, QR-Beitritt). Es ersetzt nicht die einzelnen, datierten Analyse- und Aufgabenlisten (`improvement_plan*.md`, `web_android_diff.md` usw.); jene bleiben als historisches Protokoll bestehen. Dieses Dokument ist dafür gedacht, **vor** dem Bau eines neuen Spiels oder einer neuen Funktion konsultiert zu werden, damit bereits behobene Fehlerklassen nicht erneut eingeführt werden.

**Pflege:** Wird eine neue, verallgemeinerbare Regel in einer künftigen Analyse gefunden, gehört sie hierher (nicht nur in den jeweiligen Analysebericht). Dieselbe Datei liegt identisch in beiden Projektordnern (`beachbingo-web/ARCHITEKTUR_RICHTLINIEN.md` und `Beachbingo/ARCHITEKTUR_RICHTLINIEN.md`); bei Änderungen bitte in beiden aktualisieren.

---

## 1. Navigation

### Grundregel
Jede "Zurück"-Aktion navigiert zu einer **festen Zieladresse** und **ersetzt** den aktuellen Verlaufseintrag, statt sich auf die Position im Navigationsstapel zu verlassen. Nie `navigate(-1)` (Web) oder ein blindes `popBackStack()` verwenden, wenn das Ziel eigentlich immer feststeht.

**Hintergrund:** Ein einfaches Zurückgehen um eine Position bricht, sobald irgendwo weiter unten im Stapel bereits ein Eintrag ersetzt statt entfernt wurde. Diese Fehlerklasse trat wiederholt an immer neuen Stellen auf (Berichte 9–13: Lobbys, dann Kategorie-Screens, dann Einstellungen/Ergebnis-Screens).

### Web (React Router)
```tsx
// Richtig: feste Zieladresse + replace
onClick={() => navigate("/home", { replace: true })}
onClick={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })}

// Falsch: positionsbasiert
onClick={() => navigate(-1)}
// Falsch: Ziel steht fest, aber ohne replace (lässt Verlauf wachsen)
onClick={() => navigate("/home")}
```
Referenz-Screens mit korrektem Muster: `RaetselScreen.tsx`, `CardGamesScreen.tsx`, alle 19 `*LobbyScreen.tsx`.

Bekannte, noch nicht umgestellte Ausnahmen (Stand Report 13, geringes Risiko, aber inkonsistent): `CategoryScreen.tsx`, `JoinScreen.tsx`, `ProfileScreen.tsx`. Beim nächsten Kontakt mit diesen Dateien mit erledigen.

### Android (Jetpack Navigation-Compose)
```kotlin
// Richtig: Rueckkehr zu einem konkreten Screen, robust gegen Direkt-Wiedereinstieg
onNavigateBack = {
    val didPop = navController.popBackStack<Screen.KuestenkriegLobby>(inclusive = false)
    if (!didPop) {
        navController.navigate(Screen.KuestenkriegLobby) {
            popUpTo(Screen.Home) { inclusive = false }
        }
    }
}

// Richtig fuer Kategorie-Ebenen: einfacher popBackStack() ist hier sicher,
// weil Android popUpTo bereits routenbasiert (nicht positionsbasiert) arbeitet
onNavigateBack = { navController.popBackStack() }
```
Android ist strukturell robuster als Web, weil `popUpTo`/`popBackStack<Type>` den **gesamten** Stapel nach der Zielroute durchsuchen, unabhängig von der Tiefe. Web hat dazu keine Entsprechung: `replace: true` ersetzt ausschließlich die oberste Position. Genau deshalb muss auf Web jede Zielroute von vornherein mit `replace: true` geschrieben werden, nicht erst nachträglich.

### Neue Screens mit direktem Wiedereinstieg
Wird ein Screen sowohl über eine Lobby als auch **direkt** (z. B. "gespeichertes Spiel fortsetzen" vom Hauptbildschirm) erreichbar sein, muss der Zurück-Mechanismus beide Einstiegswege abdecken (siehe Android-Beispiel oben). Ein reines `popUpTo(Lobby){inclusive=true}` ohne Fallback bricht, wenn die Lobby beim Direkteinstieg nie gepusht wurde.

---

## 2. Zentrale Module (keine Einzellösungen pro Spiel)

Jedes neue Spiel bindet sich an die folgenden zentralen Module an. Ein Spiel, das eine eigene Parallellösung für eine dieser Funktionen baut, ist ein Regelverstoß, auch wenn es funktioniert.

| Funktion | Web-Modul | Android-Pendant | Regel |
|---|---|---|---|
| Sound & Musik | `src/audio/AudioManager.ts` (Singleton) | zentraler Audio-Manager | Nie `new Audio(...)` direkt in einem Screen. Jedes Spiel bekommt mindestens Musik und grundlegende SFX (Klick, Erfolg, Fehler). |
| Favoriten | `src/favorites.ts` → `useFavorite(gameId)` | Firestore-Feld `users/{uid}.favoriteGames` direkt | Favoriten **immer** über Firestore (`users/{uid}.favoriteGames`), nie über `localStorage`. Der Hauptbildschirm liest ausschließlich dieses Feld. |
| Speicherstände | `src/gameSave.ts`, `src/puzzleSave.ts` | entsprechendes zentrales Save-Repository | Kein spielspezifischer Parallel-Speichermechanismus. |
| QR-Code-Erzeugung | `qrcode.react` (`QRCodeSVG`) | `QrCodeImage(content, size)` (generische Compose-Komponente) | Siehe Abschnitt 4 für das URL-Schema. |
| Beitritts-Logik | `JoinScreen.tsx` (ein Screen für alle Spieltypen) | `JoinViewModel` + `JoinGameScreen.kt` (ein Screen für alle Spieltypen) | Kein eigener Beitritts-Screen pro Spiel. Neues Spiel = neuer `when`/`case`-Zweig in der bestehenden Datei. |
| Regeln-Anzeige | `GameRulesModal` + `gameRules.ts` (`GAME_RULES`) | entsprechendes zentrales Regel-Modal | Kein eigenes Regel-Popup pro Spiel. |
| HUD / Pause / Speichern-und-Beenden während des Spiels | `components/GameHudBar.tsx` (`GameHudBar`, `GameSaveQuitDialog`) | entsprechende zentrale HUD-Komponente | Neue Spielbildschirme importieren diese Komponente, statt eine eigene Pause-Leiste zu bauen. |

**Bekannte, noch offene Lücke (Stand Report 13):** DünenSchatten, Inselbrücke, Strandoku, WellenSumme und WortWelle sind noch nicht an den AudioManager angebunden (weder Musik noch SFX). Beim nächsten Kontakt mit diesen Spielen nachrüsten.

---

## 3. Lobby-Header-Standard

Die Kopfzeile jeder Spiel-Lobby folgt auf beiden Plattformen derselben Reihenfolge, von links (nach Titel/Emoji) nach rechts:

**Statistik/Ergebnisse → [Galerie, falls vorhanden] → Favorit → Regeln → Einstellungen**

```tsx
// Web-Referenz: KlontauschLobbyScreen.tsx
<button title="Statistik">🏆</button>
<button title="Figurengalerie">🖼️</button>     {/* nur falls das Spiel eine Galerie hat */}
<button onClick={toggleFavorite}>{isFavorite ? "★" : "☆"}</button>
<button onClick={() => setShowRules(true)}>?</button>
<button title="Einstellungen">⚙️</button>
```
Diese Reihenfolge gilt identisch für die Android-Compose-Version derselben Lobby. Weicht eine neue Lobby davon ab, ist das ein Konsistenz-Fehler, auch wenn optisch nichts "kaputt" wirkt.

---

## 4. QR-Code und Online-Beitritt

### Wann ein Spiel einen QR-Code braucht
Jedes Spiel, dessen `playerCounts` in `gameMetadata.ts` (Web) bzw. dem Android-Äquivalent **nicht ausschließlich `SOLO`** ist, muss auf beiden Plattformen einen QR-Code zum Beitritt anbieten. Aktuell betrifft das 8 Spiele: Bingo, BeachVolley/Pong, Vier4Bier, Brandung, MeerMau, Strandräuber, Küstenkrieg, Klontausch.

### URL-Schema (verbindlich, auf beiden Plattformen identisch)
```
https://beachbande.de/<pfad>/lobby?join=<code>
```
- `<code>`: 6-stelliger alphanumerischer Code (`Math.random().toString(36).substring(2,8).toUpperCase()` oder Android-Äquivalent), gleichzeitig die Firestore-Dokument-ID.
- Web erzeugt die Adresse relativ zu `window.location.origin`, Android fest mit `https://beachbande.de/...`; beides muss in Produktion zur selben Adresse führen.
- Firestore-Sammlung pro Spiel konsistent benannt, z. B. `brandungGames`, `vierGames`, `kuestenkriegGames`; beide Plattformen schreiben und lesen dieselbe Sammlung.

### Scan-Auswertung (bereits robust implementiert, so beibehalten)
- Web (`JoinScreen.tsx`): zuerst als URL parsen (`new URL(scanned).searchParams.get("join")`), erst danach Fallback auf ein Muster für lange IDs.
- Android (`JoinGameScreen.kt`): letzter zusammenhängender alphanumerischer Abschnitt ab 6 Zeichen im gescannten Text.

Ein neues Online-Spiel muss dieses Schema übernehmen, keine abweichende URL-Struktur oder einen anderen Query-Parameter-Namen als `join` einführen.

### Beitritts-Dispatch
Neues Spiel = neuer Zweig in `JoinViewModel.joinGame()` (Android) bzw. `joinWithCode()` in `JoinScreen.tsx` (Web), der die passende Firestore-Sammlung abfragt. Beide Funktionen fragen bereits alle Sammlungen parallel ab (`Promise.all` / `async`+`await`); dieses Muster für das neue Spiel fortsetzen, nicht durch einen sequenziellen Sonderweg ersetzen.

### Hinweistexte aktuell halten
Jeder Bildschirm, der die unterstützten Spiele in einem Hinweistext aufzählt (z. B. `JoinGameScreen.kt` Zeile ~156), muss bei einem neuen Online-Spiel mit aktualisiert werden. Das ist rein kosmetisch, wurde aber bereits einmal vergessen (Küstenkrieg/Klontausch fehlten dort trotz voller Funktionsfähigkeit).

---

## 5. Web/Android-Datenparität

- Beide Plattformen teilen sich dieselben Firestore-Sammlungen und Feldnamen. Ein Feld, das auf Web hinzugefügt wird, muss auf Android denselben Namen und Typ verwenden und umgekehrt.
- Wo sich die Datenstruktur zwischen den Plattformen historisch unterscheidet (Beispiel: Bingo-Mitspieler sind auf Web ein Array, auf Android eine Map), muss das **explizit** in der Join-/Lese-Logik behandelt werden, nicht stillschweigend eine der beiden Formen angenommen werden. Siehe `JoinViewModel.joinBingo()` als Referenz für den korrekten Umgang mit beiden Formen.
- Neue Felder in einem Spiel-Dokument immer so wählen, dass sie unabhängig davon funktionieren, ob die aktuelle Partie ursprünglich auf Web oder auf Android erstellt wurde.

---

## 6. Checkliste: neues Spiel hinzufügen

Vor dem Abschluss eines neuen Spiels (oder einer größeren Spiel-Überarbeitung) prüfen:

- [ ] Zurück-Navigation nutzt feste Zieladressen mit `replace: true` (Web) bzw. routenbasiertem `popUpTo`/`popBackStack<Type>` (Android), siehe Abschnitt 1.
- [ ] Sound und Musik laufen über den zentralen AudioManager, keine eigene Audio-Instanz.
- [ ] Favoriten-Stern schreibt in `users/{uid}.favoriteGames` über `useFavorite()` (Web) bzw. das Android-Firestore-Muster, nicht in `localStorage`.
- [ ] Speicherstände laufen über `gameSave.ts`/`puzzleSave.ts` bzw. das zentrale Android-Repository.
- [ ] Lobby-Header folgt der Reihenfolge Statistik → [Galerie] → Favorit → Regeln → Einstellungen, identisch auf beiden Plattformen.
- [ ] Regeln-Anzeige nutzt `GameRulesModal`/`GAME_RULES` bzw. das Android-Pendant.
- [ ] Falls Mehrspieler-fähig (`playerCounts` ≠ nur `SOLO`): QR-Code nach dem Schema aus Abschnitt 4, Beitritts-Dispatch in `JoinScreen.tsx`/`JoinViewModel` ergänzt, Hinweistexte aktualisiert.
- [ ] Firestore-Feldnamen und -Struktur mit der jeweils anderen Plattform abgeglichen (Abschnitt 5).
- [ ] Direkter Wiedereinstieg (z. B. "gespeichertes Spiel fortsetzen" vom Hauptbildschirm) getestet, nicht nur der Weg über die Lobby.

---

## 7. Herkunft der Regeln (zur Nachvollziehbarkeit)

| Regel | Zuerst dokumentiert in |
|---|---|
| Feste Zieladresse + replace statt `navigate(-1)` | Analyse 9, vertieft in 10, 11, 13 |
| Android `popUpTo`/`popBackStack<Type>`-Fallback bei Direkt-Wiedereinstieg | Analyse 10 |
| Zentrale Favoriten-Speicherung (Firestore statt localStorage) | Analyse 12, behoben in Analyse 13 |
| Lobby-Header-Reihenfolge inkl. Klontausch-Sonderfall | Analyse 9/10, bestätigt behoben in Analyse 11/12 |
| QR-Code-URL-Schema und Beitritts-Dispatch | Analyse 6, vertieft in Analyse 12 |
| Audio-Zentralisierung und Abdeckungslücke bei 5 Rätselspielen | Analyse 6, weiterhin offen (Analyse 12/13) |
| Web/Android-Datenstruktur-Unterschiede explizit behandeln (Bingo-Beispiel) | Analyse 12 |
| Build-Tooling-Upgrade-Prozess als zusammenhängende Versionsmatrix | Analyse 14 |
| Feature-Flag-Hygiene: kein teilweises Entfernen von Implementierungen hinter Flags | Analyse 14 |

---

## 8. Build-Tooling-Upgrade-Prozess (Android)

Android-Build-Werkzeuge bilden eine zusammenhängende **Versionsmatrix**: Android Gradle Plugin (AGP), Kotlin, KSP/KSP2, Hilt und Gradle sind gegenseitig abhängig und müssen als Einheit behandelt werden, nicht als unabhängige Einzelkomponenten.

### Vorgehen bei Upgrades

- **Schrittweise upgraden:** Nie mehrere Hauptkomponenten gleichzeitig auf neue Major-Versionen heben. Erst ein Werkzeug anheben, Build prüfen, dann weiter.
- **Rücknahme-Bereitschaft:** Zeigt sich eine Inkompatibilität (z. B. AGP-Version noch nicht kompatibel mit einer neueren Gradle-Version), den zuletzt geänderten Schritt bewusst zurücknehmen und einen kompatiblen Zwischenstand herstellen. Kein Durchdrücken von inkompatiblen Kombinationen.
- **Kompatibilitäts-Flags aufräumen:** Temporäre Flags in `gradle.properties`, die nur während des Upgrade-Prozesses nötig sind, nach Abschluss wieder entfernen, damit die Datei minimal bleibt.
- **Kommentare aktuell halten:** Kommentare in Build-Dateien, die auf abgelöste Werkzeuge verweisen (z. B. ein Kapt-Kommentar nach KSP-Migration), sofort entfernen oder korrigieren.

**Positiv-Referenz:** Report 14 (AGP 8.5.2→9.2.1, Kotlin 2.0.21→2.2.20, Kapt→KSP2, Hilt 2.52→2.59.2, Gradle 9.4.1→9.7.1): Ein Gradle-9.7.1-Schritt wurde bewusst zurückgenommen und erst nach dem AGP-Upgrade wieder eingeführt.

---

## 9. Feature-Flag-Hygiene

Wird Code hinter einem deaktivierten Feature-Flag (`val FEATURE = false`, `const FEATURE_ENABLED = false` o. Ä.) bei einer **Warnungs-Bereinigung** oder einem Refactoring als unerreichbar erkannt und gelöscht, gilt ohne Ausnahme:

**Entweder vollständig entfernen oder vollständig behalten.**

- **Vollständig entfernen:** Flag-Konstante, alle UI-Zweige, die das Flag abfragen, und die gesamte zugehörige Hintergrundlogik werden gelöscht. Kein loser Kommentar, der ein späteres Wiedereinschalten verspricht, darf zurückbleiben.
- **Vollständig behalten:** Die Implementierung hinter dem Flag bleibt vollständig erhalten. Das Flag bleibt auf `false` stehen. Ein Kommentar darf nur dann versprechen, dass ein Umschalten das Feature wieder aktiviert, wenn die dafür notwendige Logik noch vorhanden ist.

**Verboten:** Eine Mischform, bei der das Flag und ein versprechender Kommentar stehen bleiben, die dahinterliegende Implementierung aber gelöscht wurde. Das erzeugt eine Dokumentationsfalle: Ein späteres Umschalten führt zu einer kaputten Oberfläche ohne Fehlermeldung.

**Referenz:** Klontausch `TAUSCHEN_ENABLED` in Report 14 (Android): Die Implementierung wurde bei der Warnungs-Bereinigung entfernt, Flag und Kommentar blieben stehen.
