// src/pages/EventSongsAssignment.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Divider,
  Paper,
  Stack,
  Avatar,
  IconButton,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Snackbar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import DescriptionIcon from '@mui/icons-material/Description';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import { eventService, songService } from '../services/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const EventSongsAssignment = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [assignedSongs, setAssignedSongs] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [registrationsCount, setRegistrationsCount] = useState({});
  const [documentsCount, setDocumentsCount] = useState({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carica evento
      const eventResponse = await eventService.getById(id);
      setEvent(eventResponse.data.data);

      // Carica brani assegnati
      const songsResponse = await eventService.getSongs(id);
      setAssignedSongs(songsResponse.data.data || []);

      // Carica tutti i brani
      const allSongsResponse = await songService.getAll();
      setAllSongs(allSongsResponse.data.data || []);

      // Carica conteggi registrazioni e documenti
      // (assumendo che il backend fornisca questi dati)
      // TODO: implementare chiamate API per conteggi

    } catch (err) {
      console.error('Errore:', err);
      setError('Errore durante il caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSong = async (song) => {
    try {
      // TODO: implementare chiamata API per aggiungere brano all'evento
      console.log('Aggiungendo brano:', song.title);
      setSnackbar({
        open: true,
        message: `✅ "${song.title}" aggiunto all'evento`,
        severity: 'success'
      });
      await loadData();
      setOpenDialog(false);
    } catch (err) {
      setSnackbar({
        open: true,
        message: '❌ Errore durante aggiunta brano',
        severity: 'error'
      });
    }
  };

  const handleRemoveSong = async (song) => {
    try {
      // TODO: implementare chiamata API per rimuovere brano dall'evento
      console.log('Rimuovendo brano:', song.title);
      setSnackbar({
        open: true,
        message: `🗑️ "${song.title}" rimosso dall'evento`,
        severity: 'info'
      });
      await loadData();
    } catch (err) {
      setSnackbar({
        open: true,
        message: '❌ Errore durante rimozione brano',
        severity: 'error'
      });
    }
  };

  const handleOpenDocuments = (song) => {
    // TODO: navigare alla pagina documenti del brano
    console.log('Aprendo documenti per:', song.title);
  };

  const filteredSongs = allSongs.filter(song => {
    if (searchQuery.isEmpty) return true;
    return song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (song.composer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
  });

  const availableSongs = filteredSongs.filter(
    song => !assignedSongs.some(s => s.id === song.id)
  );

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          component={Link}
          to={`/event/${id}`}
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Torna all'evento
        </Button>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Evento non trovato</Alert>
        <Button
          component={Link}
          to="/"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Torna agli eventi
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Pulsante indietro */}
      <Button
        component={Link}
        to={`/event/${id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Torna all'evento
      </Button>

      {/* ✅ HEADER CON IMMAGINE EVENTO */}
      {event.image_url && (
        <Box
          sx={{
            height: 200,
            backgroundImage: `url(${event.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 2,
            mb: 3,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'flex-end',
              padding: 3,
            }}
          >
            <Box>
              <Typography variant="h4" color="white" fontWeight="bold">
                {event.title}
              </Typography>
              <Typography variant="body1" color="white" sx={{ opacity: 0.8 }}>
                {event.theme}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* ✅ DATI GENERALI EVENTO */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} alignItems="center">
                <MusicNoteIcon color="primary" />
                <Typography variant="body2">
                  {event.date ? format(new Date(event.date), 'd MMMM yyyy', { locale: it }) : 'Data non specificata'}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon color="primary" />
                <Typography variant="body2">
                  {assignedSongs.length} brani in scaletta
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ✅ LISTA BRANI ASSEGNATI */}
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
        🎵 Brani in scaletta ({assignedSongs.length})
      </Typography>

      {assignedSongs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Icon sx={{ fontSize: 64, color: 'text.disabled' }}>
            <MusicNoteIcon />
          </Icon>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Nessun brano assegnato a questo evento
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ mt: 2 }}
          >
            Aggiungi Brani
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {assignedSongs.map((song, index) => (
            <Grid item xs={12} md={6} key={song.id}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* Avatar con numero */}
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        width: 36,
                        height: 36,
                        fontSize: 16,
                      }}
                    >
                      {index + 1}
                    </Avatar>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" noWrap>
                        {song.title || 'Senza titolo'}
                      </Typography>

                      {song.composer && (
                        <Typography variant="caption" color="text.secondary">
                          {song.composer}
                        </Typography>
                      )}

                      {/* Badge compatti */}
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        {song.genre && (
                          <Chip
                            label={song.genre}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        )}
                        {song.difficulty && (
                          <Chip
                            label={song.difficulty}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        )}
                      </Stack>
                    </Box>

                    {/* Pulsanti azioni */}
                    <IconButton
                      color="primary"
                      onClick={() => handleOpenDocuments(song)}
                      title="Documenti"
                    >
                      <DescriptionIcon />
                    </IconButton>

                    <IconButton
                      color="error"
                      onClick={() => handleRemoveSong(song)}
                      title="Rimuovi"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ✅ PULSANTE AGGIUNGI BRANO */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{ px: 4, py: 1.5 }}
        >
          Aggiungi Brani alla Scaletta
        </Button>
      </Box>

      {/* ✅ DIALOG PER AGGIUNGERE BRANI */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MusicNoteIcon color="primary" />
            <Typography variant="h6">Aggiungi Brani</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Cerca brani..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {availableSongs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                Nessun brano disponibile
              </Typography>
            ) : (
              availableSongs.map((song) => (
                <ListItemButton
                  key={song.id}
                  onClick={() => handleAddSong(song)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <MusicNoteIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={song.title}
                    secondary={song.composer || 'Nessun compositore'}
                  />
                  <AddIcon color="primary" />
                </ListItemButton>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Chiudi</Button>
        </DialogActions>
      </Dialog>

      {/* ✅ SNACKBAR PER NOTIFICHE */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EventSongsAssignment;