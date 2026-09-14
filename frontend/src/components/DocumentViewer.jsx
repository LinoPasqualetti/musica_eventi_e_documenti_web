// src/components/DocumentViewer.jsx
import React, { useMemo } from 'react';
import {
  Dialog, AppBar, Toolbar, IconButton, Typography, Box,
  Alert, Button, Stack, Chip, Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import DescriptionIcon from '@mui/icons-material/Description';
import MidiPlayer from './MidiPlayer';
import ScoreViewer from './ScoreViewer';

const API_BASE = '/api';

function resolveKind(doc) {
  const ext = (doc.file_name || '').split('.').pop().toLowerCase();
  const type = (doc.doc_type || '').toLowerCase();

  if (type === 'pdf' || ext === 'pdf') return 'pdf';
  if (type === 'mid' || type === 'kar' || ext === 'mid' || ext === 'kar' || ext === 'midi') return 'midi';
  if (type === 'mxl' || ext === 'mxl' || ext === 'xml' || ext === 'musicxml') return 'score'; // ← unificato
  if (type === 'abc' || ext === 'abc') return 'score';  // ← unificato
  if (type === 'audio_mp3' || type === 'audio_wav' || ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a') return 'audio';
  if (type === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'image';
  return 'other';
}

function iconFor(kind) {
  switch (kind) {
    case 'pdf':   return <PictureAsPdfIcon />;
    case 'image': return <ImageIcon />;
    case 'audio': return <AudiotrackIcon />;
    case 'midi':  return <MusicNoteIcon />;
    case 'score': return <DescriptionIcon />;
    default:      return <DescriptionIcon />;
  }
}

export default function DocumentViewer({ document: doc, open, onClose }) {
  const kind = useMemo(() => (doc ? resolveKind(doc) : 'other'), [doc]);
  const contentUrl = doc ? `${API_BASE}/documents/${doc.id}/content` : '';

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { backgroundColor: '#1e1e1e', color: 'white' } }}
    >
      <AppBar position="sticky" sx={{ backgroundColor: '#311b92' }}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="chiudi">
            <CloseIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, flex: 1, minWidth: 0 }}>
            {iconFor(kind)}
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {doc?.file_name || 'Documento'}
            </Typography>
            {doc?.doc_type && (
              <Chip
                label={doc.doc_type}
                size="small"
                sx={{ height: 18, fontSize: 10, color: 'white', backgroundColor: 'rgba(255,255,255,0.2)' }}
              />
            )}
          </Box>

          <Tooltip title="Apri in nuova scheda">
            <IconButton color="inherit" component="a" href={contentUrl} target="_blank" rel="noopener noreferrer">
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Scarica">
            <IconButton color="inherit" component="a" href={contentUrl} download={doc?.file_name}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 0, display: 'flex', flexDirection: 'column' }}>
        {!doc ? (
          <Alert severity="warning" sx={{ m: 2 }}>Nessun documento selezionato</Alert>
        ) : kind === 'pdf' ? (
          <Box
            component="iframe"
            src={contentUrl}
            title={doc.file_name}
            sx={{ flex: 1, width: '100%', border: 0, minHeight: '80vh' }}
          />
        ) : kind === 'image' ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Box
              component="img"
              src={contentUrl}
              alt={doc.file_name}
              sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 1 }}
            />
          </Box>
        ) : kind === 'audio' ? (
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <AudiotrackIcon sx={{ fontSize: 96, color: '#9575cd' }} />
            <Typography variant="h6">{doc.file_name}</Typography>
            <Box
              component="audio"
              controls
              autoPlay
              src={contentUrl}
              sx={{ width: '100%', maxWidth: 600 }}
            />
          </Box>
        ) : kind === 'midi' ? (
          open ? <MidiPlayer contentUrl={contentUrl} fileName={doc.file_name} /> : null
        ) : kind === 'score' ? (
          open ? <ScoreViewer contentUrl={contentUrl} fileName={doc.file_name} fallbackTitle={doc.file_name} /> : null
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Tipo di documento non supportato inline ({doc.doc_type || 'sconosciuto'})
            </Alert>
            <Button variant="contained" href={contentUrl} download={doc.file_name}>
              Scarica file
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}