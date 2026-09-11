/**
 * Fix del dump: converte unistr('...') in stringhe SQLite normali
 */

const fs = require('fs');

const INPUT = 'dump_full.sql';
const OUTPUT = 'dump_fixed.sql';

console.log('🔧 Fix del dump: conversione unistr()\n');

let sql = fs.readFileSync(INPUT, 'utf-8');
console.log(`📄 Input: ${(sql.length / 1024 / 1024).toFixed(2)} MB`);

let count = 0;

// Sostituisce unistr('...') con stringa normalizzata
sql = sql.replace(/unistr\('((?:[^']|'')*)'\)/g, (match, content) => {
  count++;
  // Decodifica escape unicode \uXXXX, \n, \t, \\, ecc.
  const decoded = content.replace(
    /\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|t|r|\\)/g,
    (m, esc) => {
      if (esc.startsWith('u')) return String.fromCodePoint(parseInt(esc.slice(1), 16));
      if (esc.startsWith('x')) return String.fromCharCode(parseInt(esc.slice(1), 16));
      switch (esc) {
        case 'n': return '\n';
        case 't': return '\t';
        case 'r': return '\r';
        case '\\': return '\\';
        default: return m;
      }
    }
  );
  // Re-escape apici singoli per SQL
  const escaped = decoded.replace(/'/g, "''");
  return `'${escaped}'`;
});

console.log(`✅ ${count} chiamate unistr() convertite`);
fs.writeFileSync(OUTPUT, sql, 'utf-8');
console.log(`📄 Output: ${OUTPUT}\n`);