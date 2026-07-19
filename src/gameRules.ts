export interface GameRule {
  id: string;
  title: string;
  emoji: string;
  color: string;
  tagline: string;
  goal: string;
  rules: string[];
  proTip: string;
}

export const GAME_RULES: Record<string, GameRule> = {
  bingo: {
    id: "bingo",
    title: "BeachBingo",
    emoji: "🎱",
    color: "#0ea5e9",
    tagline: "Das Spiel, bei dem Schreien zur Pflicht gehört.",
    goal: "Als Erstes eine vollständige Reihe markieren — und BINGO brüllen!",
    rules: [
      "Jeder Spieler erhält eine zufällige Bingo-Karte mit Zahlen.",
      "Der Host zieht Zahl für Zahl — tippe drauf, wenn du sie auf deiner Karte hast.",
      "Vollständige Reihe (horizontal, vertikal oder diagonal) = BINGO!",
      "2–6 Spieler können gleichzeitig mitspielen.",
    ],
    proTip: "Schreie \"BINGO!\" so laut wie möglich — auch wenn du noch nicht gewonnen hast. Schockiert die Konkurrenz und macht gute Stimmung.",
  },
  pong: {
    id: "pong",
    title: "BeachVolley",
    emoji: "🏓",
    color: "#f97316",
    tagline: "Sand, Schweiß und Spielverderber.",
    goal: "Den Ball übers Netz spielen und mehr Punkte als der Gegner holen.",
    rules: [
      "Tippe auf deine Seite, um den Ball zurückzuschlagen.",
      "Wer den Ball nicht rechtzeitig zurückspielt, verliert den Punkt.",
      "Erster mit der festgelegten Punktzahl gewinnt den Satz.",
      "Mehrere Runden und Sätze möglich.",
    ],
    proTip: "Ballgefühl ist alles. Handy-Schweiß ist dein Feind. Hände vor dem Spiel abwischen — dringend empfohlen.",
  },
  vier: {
    id: "vier",
    title: "Vier4Bier",
    emoji: "🍺",
    color: "#f59e0b",
    tagline: "Strategie meets Strandbar. Denken optional.",
    goal: "Vier eigene Steine in einer Reihe — und den Gegner zum Trinken bringen.",
    rules: [
      "Spieler setzen abwechselnd einen Stein in eine der 7 Spalten.",
      "Steine fallen nach unten (Schwerkraft gilt auch am Strand).",
      "Vier Steine in einer Reihe — horizontal, vertikal oder diagonal — gewinnt.",
      "Verlierer trinkt. Bei Unentschieden trinken alle. So einfach ist das.",
      "Auch gegen KI spielbar — die trinkt leider nicht mit.",
    ],
    proTip: "Strategie ist gut. Den Gegner ablenken ist besser. Auf die Möwen zeigen wirkt eigentlich immer.",
  },
  pirates: {
    id: "pirates",
    title: "BeachPirates",
    emoji: "🐙",
    color: "#a855f7",
    tagline: "Kein echter Rum. Trotzdem viel Action.",
    goal: "So viele Wellen von Quallen, Muscheln und Fischen abwehren wie möglich.",
    rules: [
      "Bewege deine Figur mit Wischgesten oder dem Steuerkreuz.",
      "Dein Charakter schießt automatisch auf ankommende Gegner.",
      "Jeder Treffer kostet dich ein Leben.",
      "Besiege ganze Wellen für Bonuspunkte.",
      "Sammle Power-Ups für temporäre Vorteile.",
    ],
    proTip: "Quallen mögen keine Strandläufer. Du magst keine Quallen. Ihr habt mehr gemeinsam als gedacht — und trotzdem müssen sie weg.",
  },
  worm: {
    id: "worm",
    title: "Wattwurm",
    emoji: "🪱",
    color: "#22c55e",
    tagline: "Snake. Aber nass.",
    goal: "So lang wie möglich überleben, ohne den Rand oder dich selbst zu treffen.",
    rules: [
      "Steuere den Wurm mit Wischgesten oder Richtungstasten.",
      "Friss Krabben, Muscheln und Fische für Punkte und Länge.",
      "Rand berühren oder in den eigenen Körper fahren = Game Over.",
      "Je länger du überlebst, desto schneller wird der Wurm.",
    ],
    proTip: "Würmer haben keine Bremsen. Du auch nicht. Hoffentlich hast du gute Reflexe — und kein zweites Bier in der Hand.",
  },
  strandturm: {
    id: "strandturm",
    title: "Strandturm",
    emoji: "🗼",
    color: "#dc2626",
    tagline: "Was raufgeht, kommt auch runter. Besonders Kokosnüsse.",
    goal: "Klettere den Pier so hoch wie möglich — und weiche Kokosnüssen aus.",
    rules: [
      "Tippe links oder rechts, um die Seite zu wechseln.",
      "Kokosnüsse fallen von oben — weiche ihnen aus.",
      "Je höher du kletterst, desto mehr Punkte bekommst du.",
      "Ein Treffer = Game Over. Kein zweites Leben, kein Pardon.",
    ],
    proTip: "Physik ist auf dem Pier leider keine Meinung. Die Kokosnüsse sind sehr real. Dein Kopf auch.",
  },
  brandung: {
    id: "brandung",
    title: "Brandung",
    emoji: "🌊",
    color: "#0d9488",
    tagline: "31 ist die magische Zahl. Manchmal das Beste, worauf man hoffen kann.",
    goal: "Als Erstes Karten mit einem Gesamtwert nahe 31 in einer einzigen Farbe halten.",
    rules: [
      "Jeder startet mit 3 Karten auf der Hand.",
      "Reihum: eine Karte vom Stapel nehmen, eine ablegen.",
      "Kartenwerte: Ass = 11, Bildkarten = 10, alle anderen = Nennwert.",
      "Nur Karten gleicher Farbe zählen zusammen!",
      "Wer \"Klopfen\" sagt, gibt allen anderen eine letzte Runde.",
      "Wer am Ende den niedrigsten Wert hat, verliert ein Leben.",
      "Alle 3 Leben verloren = ausgeschieden. Letzter mit Leben gewinnt!",
    ],
    proTip: "\"Klopfen\" zu früh ist wie zu früh \"BINGO\" zu rufen. Klappt manchmal. Meistens endet es in kollektivem Augenrollen.",
  },
};
