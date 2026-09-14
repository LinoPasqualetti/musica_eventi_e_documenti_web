/**
 * popola-blob.js
 *
 * Legge i documenti con storage_mode='blob' ma content=NULL,
 * carica il file fisico da file_path (o da uploads/ come fallback)
 * e aggiorna il DB con il contenuto BLOB.
 *
 * Uso: node scripts/popola-blob.js
 */

const fs = require('fs');
const path = require('path');

// Importa tramite index.js (che istanzia già i modelli con sequelize)
const { Document, sequelize } = require('../src/models');

async function popolaBlob() {
  console.log('=== Popolamento BLOB mancanti ===\n');

  try {
    await sequelize.authenticate();
    console.log('[OK] Connesso al DB\n');

    // Trova i documenti con BLOB vuoto
    const documents = await Document.findAll({
      where: {
        storage_mode: 'blob',
        content: null
      }
    });

    console.log(`Trovati ${documents.length} documenti da popolare\n`);

    let ok = 0;
    let fail = 0;

    for (const doc of documents) {
      console.log(`--- ${doc.id} | ${doc.file_name} ---`);
      console.log(`    file_path: ${doc.file_path}`);

      let buffer = null;

      // 1. Prova il file_path originale
      if (doc.file_path && fs.existsSync(doc.file_path)) {
        buffer = fs.readFileSync(doc.file_path);
        console.log(`    [OK] Letto da file_path (${buffer.length} bytes)`);
      } else {
        console.log(`    [--] file_path non accessibile, provo uploads/`);

        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);

          // 2. Fallback: cerca in uploads/{id}_*
          let matching = files.find(f => f.startsWith(`${doc.id}_`));

          // 3. Fallback: cerca per nome file
          if (!matching) {
            matching = files.find(f => f.includes(doc.file_name));
          }

          if (matching) {
            const uploadPath = path.join(uploadsDir, matching);
            buffer = fs.readFileSync(uploadPath);
            console.log(`    [OK] Letto da uploads/${matching} (${buffer.length} bytes)`);
          }
        }
      }

      if (!buffer) {
        console.log(`    [FAIL] Impossibile trovare il file`);
        fail++;
        continue;
      }

      // Aggiorna il BLOB nel DB (force: true per bypassare eventuali hook)
      doc.content = buffer;
      doc.changed('content', true);
      await doc.save({ silent: true });
      console.log(`    [SALVATO] BLOB aggiornato nel DB\n`);
      ok++;
    }

    console.log('\n=== Report ===');
    console.log(`Totale:   ${documents.length}`);
    console.log(`Successo: ${ok}`);
    console.log(`Falliti:  ${fail}`);

  } catch (error) {
    console.error('[ERRORE]', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

popolaBlob();
