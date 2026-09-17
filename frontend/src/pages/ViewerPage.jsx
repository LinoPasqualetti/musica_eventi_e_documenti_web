// [NUOVO] C:\musica_eventi_e_documenti_web\frontend\src\pages\ViewerPage.jsx

/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\frontend\src\pages\ViewerPage.jsx
 *
 * 📝 DESCRIZIONE:
 * Pagina /viewer?id=<abc_id>&transpose=<n>&instrument=<n>&fileName=<nome>
 *
 * - Legge id, transpose, instrument, fileName dalla query string
 * - Fa fetch di GET /api/abc-temp/:id per ottenere l'ABC
 * - Crea un Blob URL e monta <AbcViewer contentUrl={blobUrl} />
 *
 * Viene aperta sia dal browser (link diretto) sia dall'app desktop Flutter
 * (che passa l'id generato via POST /api/abc-temp).
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
//import AbcViewer from '../components/AbcViewer';
import ScoreViewer from '../components/ScoreViewer';
export default function ViewerPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const fileName = params.get('fileName') || 'spartito';

  const [abcUrl, setAbcUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('Parametro "id" mancante nella URL');
      return;
    }

    let revoked = false;
    let blobUrl = null;

    (async () => {
      try {
        const res = await fetch(`/api/abc-temp/${id}`);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body}`);
        }
        const { abc } = await res.json();
        const blob = new Blob([abc], { type: 'text/plain;charset=utf-8' });
        blobUrl = URL.createObjectURL(blob);
        if (!revoked) {
          setAbcUrl(blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (e) {
        if (!revoked) setError(e.message);
      }
    })();

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          <Typography variant="subtitle1" fontWeight={600}>
            Errore caricamento spartito
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!abcUrl) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 6,
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
        <Typography variant="caption" color="text.secondary">
          Caricamento spartito…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
     <ScoreViewer contentUrl={abcUrl} fileName={fileName} fallbackTitle={fileName} />
    </Box>
  );
}