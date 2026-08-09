#!/usr/bin/env python3
"""
clean_targets.py  —  WortWelle Beugungsformen-Bereinigung
=========================================================
Verwendet OpenThesaurus (CC BY-SA) als Quelle fuer deutsche Grundformen.
Filtert die targets_*.txt Dateien und kopiert das Ergebnis auch in den
Android-Asset-Ordner.

Ausfuehren:  python clean_targets.py
"""

import urllib.request
import zipfile
import io
import re
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR    = os.path.join(SCRIPT_DIR, 'public', 'wortwelle')
ANDROID_DIR = r'C:\Users\Chef\AndroidStudioProjects\Beachbingo\app\src\main\assets\wortwelle'

OPENTHESAURUS_URL = 'https://www.openthesaurus.de/export/OpenThesaurus-Textversion.zip'

# Gleiche Umlaut-Substitution wie im Spiel
UMLAUT_TAB = str.maketrans({
    'ä': 'AE', 'Ä': 'AE',
    'ö': 'OE', 'Ö': 'OE',
    'ü': 'UE', 'Ü': 'UE',
    'ß': 'SS', 'ẞ': 'SS',
})

def normalize(word: str) -> str:
    return word.translate(UMLAUT_TAB).upper()

def load_lemma_set() -> set[str]:
    zip_data: bytes | None = None

    # Lokale Datei als Fallback
    local = os.path.join(SCRIPT_DIR, 'OpenThesaurus-Textversion.zip')
    if os.path.exists(local):
        print(f'Verwende lokale Datei: {local}')
        with open(local, 'rb') as f:
            zip_data = f.read()
    else:
        print(f'Lade herunter: {OPENTHESAURUS_URL}')
        try:
            req = urllib.request.Request(
                OPENTHESAURUS_URL,
                headers={'User-Agent': 'Mozilla/5.0 (BeachBande/1.0)'},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                zip_data = resp.read()
            print(f'  {len(zip_data)//1024} KB heruntergeladen')
        except Exception as exc:
            print(f'FEHLER beim Download: {exc}')
            print()
            print('Bitte OpenThesaurus-Textversion.zip manuell von')
            print('  https://www.openthesaurus.de/export/OpenThesaurus-Textversion.zip')
            print(f'herunterladen und neben diesem Skript ablegen:')
            print(f'  {local}')
            print('Danach Skript erneut ausfuehren.')
            raise SystemExit(1)

    lemmas: set[str] = set()
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        for name in zf.namelist():
            if not name.endswith('.txt'):
                continue
            print(f'  Verarbeite: {name}')
            with zf.open(name) as f:
                for raw_line in f:
                    line = raw_line.decode('utf-8', errors='ignore').strip()
                    if not line or line.startswith('#') or line.startswith('('):
                        continue
                    # Format: "Term1; Term2 (Annotation); Term3"
                    for term in line.split(';'):
                        term = re.sub(r'\(.*?\)', '', term).strip().strip('"').strip()
                        if term and ' ' not in term and not any(c.isdigit() for c in term):
                            lemmas.add(term)

    print(f'  {len(lemmas):,} Grundformen aus OpenThesaurus geladen')
    result = {normalize(l) for l in lemmas}
    print(f'  {len(result):,} nach Umlaut-Normalisierung')
    return result


def process_targets(lemma_set: set[str]) -> dict[int, list[str]]:
    all_cleaned: dict[int, list[str]] = {}

    for length in [4, 5, 6, 7]:
        src = os.path.join(WEB_DIR, f'targets_{length}.txt')
        if not os.path.exists(src):
            print(f'WARN: {src} nicht gefunden, uebersprungen.')
            continue

        # utf-8-sig entfernt BOM automatisch
        with open(src, 'r', encoding='utf-8-sig') as f:
            words = [w.strip() for w in f if w.strip() and w.strip().replace(' ', '').isalpha()]

        kept    = [w for w in words if w in lemma_set]
        removed = [w for w in words if w not in lemma_set]

        print(f'\ntargets_{length}.txt:')
        print(f'  Vorher:    {len(words):>5} Woerter')
        print(f'  Nachher:   {len(kept):>5} Woerter  ({len(removed)} entfernt, {len(removed)*100//max(len(words),1)}%)')
        if removed:
            print(f'  Entfernt (Beispiele): {removed[:20]}')

        # Web-Datei ueberschreiben
        with open(src, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(kept) + '\n')

        all_cleaned[length] = kept

    return all_cleaned


def copy_to_android(all_cleaned: dict[int, list[str]]) -> None:
    if not os.path.exists(ANDROID_DIR):
        print(f'\nWARN: Android-Ordner nicht gefunden: {ANDROID_DIR}')
        print('Bitte Dateien manuell kopieren.')
        return

    for length, words in all_cleaned.items():
        dst = os.path.join(ANDROID_DIR, f'targets_{length}.txt')
        with open(dst, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(words) + '\n')
        print(f'Android: targets_{length}.txt kopiert ({len(words)} Woerter)')


def main() -> None:
    print('=== WortWelle Target-Bereinigung (OpenThesaurus) ===\n')
    lemma_set = load_lemma_set()
    print()
    all_cleaned = process_targets(lemma_set)
    print()
    copy_to_android(all_cleaned)
    print('\nFertig! Bitte die Statistiken oben pruefen.')
    print('Falls zu viele gueltiger Grundformen entfernt wurden, bitte Rueckmeldung geben.')


if __name__ == '__main__':
    main()
