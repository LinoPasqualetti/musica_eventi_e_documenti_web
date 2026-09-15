// [NUOVO] C:\musica_eventi_e_documenti_web\frontend\src\pages\MxlViewerPage.jsx

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Alert, AlertTitle, Typography } from '@mui/material';
import ScoreViewer from '../components/ScoreViewer';

export default function MxlViewerPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const fileName = params.get('fileName') || 'spartito.mxl';

  if (!id) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          <AlertTitle>Parametro mancante</AlertTitle>
          <Typography variant="body2">
            Devi specificare <code>?id=&lt;id&gt;</code> nella URL.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const contentUrl = `/api/mxl-temp/${id}/content`;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#1e1e1e',
      }}
    >
      <ScoreViewer
        contentUrl={contentUrl}
        fileName={fileName}
        fallbackTitle={fileName}
      />
    </Box>
  );
}