// src/pages/EventSongDocuments.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const EventSongDocuments = () => {
  const { id, songId } = useParams();
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/event/${id}`)} sx={{ mb: 3 }}>
        Torna all'evento
      </Button>

      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <FolderOpenIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>Documenti del brano</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Pagina in costruzione. Qui vedrai tutti i documenti disponibili per
          questo brano in questo evento: spartiti (MXL, ABC), PDF, audio, MIDI/KAR.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">Evento: {id}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">Brano: {songId}</Typography>
      </Paper>
    </Container>
  );
};

export default EventSongDocuments;