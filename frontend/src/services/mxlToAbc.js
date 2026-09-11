import { parseCompressed, serializeAbc } from 'musicxml-io';

/**
 * Converte un buffer .mxl direttamente in testo ABC
 * @param {ArrayBuffer} arrayBuffer - dati binari del file .mxl
 * @returns {Promise<string>} testo in notazione ABC
 */
export async function convertMxlToAbc(arrayBuffer) {
  // 1. Analizza il buffer .mxl in un oggetto Score
  const score = parseCompressed(arrayBuffer);

  // 2. Serializza in stringa ABC
  const abcText = serializeAbc(score, {
    // opzionale: controlla il formato dell'output
    // noteLength: '1/4',
    // barsPerLine: 4,
  });

  return abcText;
}