export type KlonPart = 'KOPF' | 'KOERPER' | 'BEINE';

export interface KlonCharacter {
  id: string;
  name: string;
  category: string;
}

export const ALL_KLON_CHARACTERS: KlonCharacter[] = [
  // Berufe
  { id: 'astronaut',           name: 'Astronaut',           category: 'Beruf' },
  { id: 'bauarbeiter',         name: 'Bauarbeiter',         category: 'Beruf' },
  { id: 'feuerwehr_frau',      name: 'Feuerwehr-Frau',      category: 'Beruf' },
  { id: 'fischer',             name: 'Fischer',             category: 'Beruf' },
  { id: 'koch',                name: 'Koch',                category: 'Beruf' },
  { id: 'modedesignerin',      name: 'Modedesignerin',      category: 'Beruf' },
  { id: 'nachrichtensprecher', name: 'Nachrichtensprecher', category: 'Beruf' },
  { id: 'pilotin',             name: 'Pilotin',             category: 'Beruf' },
  { id: 'polizist',            name: 'Polizist',            category: 'Beruf' },
  // Tiere
  { id: 'eule',                name: 'Eule',                category: 'Tier' },
  { id: 'faultier',            name: 'Faultier',            category: 'Tier' },
  { id: 'flamingo',            name: 'Flamingo',            category: 'Tier' },
  { id: 'frosch',              name: 'Frosch',              category: 'Tier' },
  // Unterhaltung
  { id: 'comedian',            name: 'Comedian',            category: 'Show' },
  { id: 'fussballstar',        name: 'Fußballstar',         category: 'Show' },
  { id: 'influencerin',        name: 'Influencerin',        category: 'Show' },
  { id: 'muskelheld',          name: 'Muskelheld',          category: 'Show' },
  { id: 'pop_diva',            name: 'Pop-Diva',            category: 'Show' },
  { id: 'rockstar',            name: 'Rockstar',            category: 'Show' },
  // Alien & Fantasy
  { id: 'green_eye',           name: 'Green Eye',           category: 'Alien' },
  { id: 'ice_baby',            name: 'Ice Baby',            category: 'Alien' },
  { id: 'one_eye',             name: 'One Eye',             category: 'Alien' },
  { id: 'splash',              name: 'Splash',              category: 'Alien' },
  { id: 'sunny_bear',          name: 'Sunny Bear',          category: 'Alien' },
  { id: 'tech_visionaer',      name: 'Tech-Visionaer',      category: 'Alien' },
  { id: 'worms',               name: 'Worms',               category: 'Alien' },
  // Meerestiere
  { id: 'clownfisch',          name: 'Clownfisch',          category: 'Meer' },
  { id: 'hummer',              name: 'Hummer',              category: 'Meer' },
  { id: 'seepferdchen',        name: 'Seepferdchen',        category: 'Meer' },
  { id: 'tintenfisch',         name: 'Tintenfisch',         category: 'Meer' },
  // Pflanzen
  { id: 'kaktuspflanze',       name: 'Kaktuspflanze',       category: 'Pflanze' },
  { id: 'palme',               name: 'Palme',               category: 'Pflanze' },
  { id: 'sonnenblume',         name: 'Sonnenblume',         category: 'Pflanze' },
  { id: 'venusfliegenfalle',   name: 'Venusfliegenfalle',   category: 'Pflanze' },
  // Comic
  { id: 'comic_pirat',         name: 'Comic-Pirat',         category: 'Comic' },
  { id: 'comic_roboter',       name: 'Comic-Roboter',       category: 'Comic' },
  { id: 'comic_superheld',     name: 'Comic-Superheld',     category: 'Comic' },
  { id: 'comic_zauberer',      name: 'Comic-Zauberer',      category: 'Comic' },
];

export function klonCharacterById(id: string): KlonCharacter {
  return ALL_KLON_CHARACTERS.find(c => c.id === id) ?? ALL_KLON_CHARACTERS[0];
}
