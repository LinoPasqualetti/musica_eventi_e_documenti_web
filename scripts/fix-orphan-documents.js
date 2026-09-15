// [NUOVO] C:\musica_eventi_e_documenti_web\scripts\fix-orphan-documents.js

const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../backend/.env');
dotenv.config({ path: envPath });

const SOURCE_DB_PATH = process.env.SQLITE_DB_PATH ||
  'C:/Users/LINOP/Documents/musica_eventi_e_documenti.db';

const TARGET_DB_PATH = path.resolve(__dirname, '../backend',
  process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db');

const UPLOADS_DIR = path.join(__dirname, '../backend/data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Creata cartella: ${UPLOADS_DIR}`);
}

const MAX_BLOB_SIZE = 1024 * 1024; // 1 MB

console.log(`📂 DB desktop: ${SOURCE_DB_PATH}`);
console.log(`📂 DB web: ${TARGET_DB_PATH}`);
console.log(`📂 Uploads dir: ${UPLOADS_DIR}`);
console.log('');

const ORPHANS = [
  {
    id: '1785775048837',
    path: 'C:\\musica_per_tutti_app\\assets\\audio\\Pino Daniele\\Alleria Bb VoxSax.pdf',
  },
  {
    id: '1785775130617',
    path: 'C:\\musica_per_tutti_app\\assets\\audio\\Pino Daniele\\Alleria Eb VoxSax.pdf',
  },
  {
    id: '1786531057938',
    path: 'C:\\musica_eventi_e_documenti\\assets\\audio\\Mp3Wavw\\02 - Con le mani.mp3',
  },
  {
    id: '1788441213916',
    path: 'C:\\Users\\LINOP\\Dropbox\\BiabDBRicerca\\ItalianeLeggera\\FinaledEFINITIVE\\XMLItalia\\Alleria -Pino Daniele VoxAcc.mxl',
  },
  {
    id: '1788441494615',
    path: 'C:\\Users\\LINOP\\Dropbox\\BiabDBRicerca\\ItalianeLeggera\\FinaledEFINITIVE\\XMLItalia\\Alleria -Pino Daniele TRASPORTATA  ACCORCIATA.mxl',
  },
  {
    id: '1788442657272',
    path: 'C:\\Users\\LINOP\\Dropbox\\BiabDBRicerca\\ItalianeLeggera\\FinaledEFINITIVE\\XMLItalia\\Alleria -Pino Daniele VoxAcc.mxl',
  },
  {
    id: '1788442788544',
    path: 'C:\\Users\\LINOP\\Dropbox\\BiabDBRicerca\\ItalianeLeggera\\FinaledEFINITIVE\\XMLItalia\\Itaca.mxl',
  },
  {
    id: '1788498595702',
    path: 'C:\\musica_eventi_e_documenti\\assets\\audio\\Mp3Wavw\\09 - The Beatles - When I\'m Sixty-Four.mp3',
  },
];

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fixDocumentOnDb(db, doc) {
  return new Promise((resolve, reject) => {
    const sourceFile = doc.path;
    if (!fs.existsSync(sourceFile)) {
      return reject(new Error(`File non trovato: ${sourceFile}`));
    }

    const fileSize = fs.statSync(sourceFile).size;
    const useBlob = fileSize <= MAX_BLOB_SIZE;

    if (useBlob) {
      const content = fs.readFileSync(sourceFile);
      db.run(
        `UPDATE documents SET content = ?, storage_mode = 'blob', file_size = ?, updated_at = ? WHERE id = ?`,
        [content, fileSize, new Date().toISOString(), doc.id],
        function (err) {
          if (err) return reject(err);
          if (this.changes === 0) {
            return reject(new Error(`Documento ${doc.id} non trovato`));
          }
          resolve({ mode: 'blob', size: fileSize });
        }
      );
    } else {
      const destFilename = `${doc.id}_${sanitizeFilename(path.basename(sourceFile))}`;
      const destPath = path.join(UPLOADS_DIR, destFilename);

      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourceFile, destPath);
      }

      const publicPath = `/uploads/${destFilename}`;

      db.run(
        `UPDATE documents SET content = NULL, storage_mode = 'remote', file_path = ?, file_size = ?, updated_at = ? WHERE id = ?`,
        [publicPath, fileSize, new Date().toISOString(), doc.id],
        function (err) {
          if (err) return reject(err);
          if (this.changes === 0) {
            return reject(new Error(`Documento ${doc.id} non trovato`));
          }
          resolve({ mode: 'remote', size: fileSize, destPath });
        }
      );
    }
  });
}

async function main() {
  const webDb = new sqlite3.Database(TARGET_DB_PATH);
  const desktopDb = new sqlite3.Database(SOURCE_DB_PATH);

  console.log('🚀 AVVIO FIX DOCUMENTI ORFANI');
  console.log('');

  let ok = 0;
  let failed = 0;

  for (const doc of ORPHANS) {
    console.log(`🔄 ${doc.id}  (${path.basename(doc.path)})`);

    try {
      const result = await fixDocumentOnDb(webDb, doc);
      console.log(`   ✅ DB web: ${result.mode} (${result.size} byte)`);
      if (result.destPath) console.log(`      → ${result.destPath}`);
    } catch (e) {
      console.log(`   ❌ DB web: ${e.message}`);
      failed++;
      continue;
    }

    try {
      const result = await fixDocumentOnDb(desktopDb, doc);
      console.log(`   ✅ DB desktop: ${result.mode}`);
    } catch (e) {
      console.log(`   ⚠️  DB desktop: ${e.message}`);
    }

    ok++;
    console.log('');
  }

  console.log('═══════════════════════════════════════════');
  console.log(`✅ Completato: ${ok} OK, ${failed} falliti`);
  console.log('');

  webDb.close();
  desktopDb.close();
}

main().catch((err) => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});