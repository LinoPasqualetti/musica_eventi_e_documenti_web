// backend/scripts/generate-catalog.js
const fs = require('fs');
const path = require('path');

const PRESET_DIR = path.join(__dirname, '..', 'public', 'soundfonts', 'generaluser');
const CATALOG_PATH = path.join(PRESET_DIR, 'catalog.json');
const CATEGORY_NAME = 'GeneralUser-GS';

console.log('📁 Scansione preset in:', PRESET_DIR);

const files = fs.readdirSync(PRESET_DIR).filter(
  (f) => f.endsWith('.json') && f !== 'catalog.json'
);

console.log(`📄 Trovati ${files.length} file di preset`);

const instruments = [];

for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));

    const presetId = file.replace('.json', '');
    const instrumentName = data.instrument || presetId;
    const category = data.category || 'Unknown';

    // BANK: è il campo `serie` (numerico), non `bank` (stringa = nome soundfont)
    const bank = Number(data.serie ?? 0);

    // PROGRAM: dal campo `program` del JSON
    // - Per strumenti melodici: 1-128 (1-based)
    // - Per drum kit: -1
    const programRaw = Number(data.program);

    // midi-audio-player usa come chiave interna:
    // - program+1 per i canali melodici (0-127 → chiave 1-128)
    // - -1 per drum kit
    let playerProgram;
    if (programRaw === -1) {
      playerProgram = -1;  // drum kit
    } else {
      playerProgram = programRaw;  // 1-128, chiave già corretta
    }

    instruments.push({
      name: instrumentName,
      program: playerProgram,
      bank: bank,
      category: category,
      presets: [
        {
          id: presetId,
          name: instrumentName,
        },
      ],
    });
  } catch (e) {
    console.error(`⚠️ Errore su ${file}:`, e.message);
  }
}

// Ordina per bank, poi program
instruments.sort((a, b) => {
  if (a.bank !== b.bank) return a.bank - b.bank;
  return a.program - b.program;
});

const catalog = {
  updatedAt: new Date().toISOString(),
  categories: [
    {
      name: CATEGORY_NAME,
      instruments,
    },
  ],
};

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));

console.log(`✅ Catalog generato: ${CATALOG_PATH}`);
console.log(`   ${instruments.length} strumenti`);

// Log dei drum kit e di alcuni strumenti chiave
console.log(`\n   🥁 Drum kit (program -1):`);
instruments.filter(i => i.program === -1).forEach((i) => {
  console.log(`     bank=${i.bank} "${i.name}" -> ${i.presets[0].id}`);
});

console.log(`\n   🎹 Primi 5 strumenti melodici:`);
instruments.filter(i => i.program > 0).slice(0, 5).forEach((i) => {
  console.log(`     bank=${i.bank} program=${i.program} "${i.name}" -> ${i.presets[0].id}`);
});