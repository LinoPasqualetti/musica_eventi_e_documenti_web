// src/components/MxlViewer.jsx — MXL decompresso manualmente e convertito in ABC
import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Chip, Stack } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import JSZip from 'jszip';
import { parse, serializeAbc } from 'musicxml-io';
import AbcViewer from './AbcViewer';

export default function MxlViewer({ contentUrl, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abcText, setAbcText] = useState(null);
  const [log, setLog] = useState([]);

  const append = (msg) => {
    console.log('[MxlViewer]', msg);
    setLog((l) => [...l.slice(-40), msg]);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAbcText(null);
    append(`Caricamento MXL: ${fileName}`);

    fetch(contentUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(async (buffer) => {
        if (cancelled) return;
        append(`Ricevuti ${buffer.byteLength} byte`);

        // 1. Usa JSZip per decomprimere il file .mxl
        const zip = await JSZip.loadAsync(buffer);
        append(`ZIP aperto: ${Object.keys(zip.files).length} voci`);

        // 2. Trova il file XML MusicXML (escludendo META-INF)
        const xmlFiles = Object.keys(zip.files).filter(
          (name) => name.toLowerCase().endsWith('.xml') && !name.startsWith('META-INF/')
        );

        // Fallback: leggi META-INF/container.xml per il percorso esplicito
        if (xmlFiles.length === 0) {
          const containerFile = zip.file('META-INF/container.xml');
          if (containerFile) {
            const containerXml = await containerFile.async('string');
            const m = containerXml.match(/full-path="([^"]+)"/i);
            if (m) xmlFiles.push(m[1]);
          }
        }

        if (xmlFiles.length === 0) {
          throw new Error('Nessun file MusicXML trovato nello ZIP');
        }

        const xmlPath = xmlFiles[0];
        append(`File XML: ${xmlPath}`);

        // 3. Estrai il testo XML
        const xmlFile = zip.file(xmlPath);
        if (!xmlFile) throw new Error(`File ${xmlPath} non trovato nello ZIP`);
        const xmlText = await xmlFile.async('string');
        append(`XML estratto: ${xmlText.length} caratteri`);

        // 4. Usa musicxml-io per analizzare il testo XML
        const score = parse(xmlText);
        append(`Analisi completata: ${score.parts?.length || 0} parti`);

        // 5. Serializza in notazione ABC
        const abc = serializeAbc(score);
        append(`Conversione ABC: ${abc.length} caratteri`);
        append(`--- PRIMI 2000 CARATTERI ---`);
        append(abc.substring(0, 2000));
        append(`--- FINE ANTEPRIMA ---`);

        if (cancelled) return;
        setAbcText(abc);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(e.message || 'Errore conversione MXL');
        append(`ERRORE: ${e.message}`);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl, fileName]);

  // ---- Stato: caricamento ----
  if (loading) {
    return (
      <Box sx={{ p: 2, width: '100%', color: 'white' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <MusicNoteIcon sx={{ color: '#ce93d8' }} />
          <Typography variant="h6" noWrap sx={{ flex: 1, fontWeight: 600 }}>
            {fileName}
          </Typography>
          <Chip
            label="MXL → ABC"
            size="small"
            sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.25)' }}
          />
        </Stack>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, gap: 2 }}>
          <CircularProgress sx={{ color: '#ce93d8' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Conversione MXL in formato ABC…
          </Typography>
        </Box>

        {/* Log live durante il caricamento */}
        <details style={{ marginTop: 16 }} open>
          <summary style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>
            Log diagnostico ({log.length})
          </summary>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#111', color: '#0f0',
              p: 2, borderRadius: 1, fontSize: 11,
              fontFamily: 'monospace', maxHeight: 200,
              overflowY: 'auto', whiteSpace: 'pre-wrap', mt: 1,
            }}
          >
            {log.join('\n') || '(nessun log)'}
          </Box>
        </details>
      </Box>
    );
  }

  // ---- Stato: errore ----
  if (error) {
    return (
      <Box sx={{ p: 2, width: '100%', color: 'white' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <MusicNoteIcon sx={{ color: '#ce93d8' }} />
          <Typography variant="h6" noWrap sx={{ flex: 1, fontWeight: 600 }}>
            {fileName}
          </Typography>
        </Stack>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <details open>
          <summary style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>
            Log diagnostico ({log.length})
          </summary>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#111', color: '#0f0',
              p: 2, borderRadius: 1, fontSize: 11,
              fontFamily: 'monospace', maxHeight: 300,
              overflowY: 'auto', whiteSpace: 'pre-wrap', mt: 1,
            }}
          >
            {log.join('\n') || '(nessun log)'}
          </Box>
        </details>
      </Box>
    );
  }

  // ---- Stato: conversione riuscita → riusa AbcViewer ----
return (
  <Box sx={{ width: '100%', p: 2 }}>
    <Alert severity="info" sx={{ mb: 2 }}>
      Modalità DEBUG: l'ABC è stato generato ma non renderizzato. Verifica l'anteprima sotto.
    </Alert>

    <details open>
      <summary style={{ color: 'white', cursor: 'pointer', fontSize: 14 }}>
        🔍 ABC generato da musicxml-io ({abcText.length} caratteri)
      </summary>
      <Box
        component="pre"
        sx={{
          backgroundColor: '#111', color: '#0f0',
          p: 2, borderRadius: 1, fontSize: 11,
          fontFamily: 'monospace',
          maxHeight: 600,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          mt: 1,
        }}
      >
        {abcText.substring(0, 3000)}
      </Box>
    </details>
  </Box>
);
}