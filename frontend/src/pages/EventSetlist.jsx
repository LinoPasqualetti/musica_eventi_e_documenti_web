// src/pages/EventSetlist.jsx
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';

const EventSetlist = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/event/${id}`)}
        sx={{ mb: 3 }}
      >
        Torna all'evento
      </Button>

      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ListAltIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Scaletta dell'evento
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Pagina in costruzione. Qui vedrai la scaletta completa dell'evento,
          con l'elenco dei brani in ordine di esecuzione.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Evento: {id}
        </Typography>
      </Paper>
    </Container>
  );
};

export default EventSetlist;