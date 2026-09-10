// src/pages/EventList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Box,
  Button,
  Stack,
  CardActionArea
} from '@mui/material';
import { eventService } from '../services/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

const EventList = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    difficulty: '',
    search: ''
  });

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await eventService.getAll(filters);
      const eventData = response.data?.data ?? response.data ?? [];
      setEvents(Array.isArray(eventData) ? eventData : []);
    } catch (err) {
      console.error('Errore:', err);
      setError(`Errore: ${err.message || 'Errore durante il caricamento degli eventi'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleEventClick = (eventId) => {
    navigate(`/event/${eventId}`);
  };

  const handleResetFilters = () => {
    setFilters({ category: '', difficulty: '', search: '' });
  };

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
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          🎵 Eventi Musicali
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {events.length} eventi trovati
        </Typography>
      </Box>

      {/* Filtri */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Cerca"
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Titolo, tema, descrizione..."
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Categoria"
            variant="outlined"
            size="small"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            <MenuItem value="concerto">Concerto</MenuItem>
            <MenuItem value="workshop">Workshop</MenuItem>
            <MenuItem value="masterclass">Masterclass</MenuItem>
            <MenuItem value="audizione">Audizione</MenuItem>
            <MenuItem value="laboratorio">Laboratorio</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Difficoltà"
            variant="outlined"
            size="small"
            value={filters.difficulty}
            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            <MenuItem value="beginner">Principiante</MenuItem>
            <MenuItem value="intermediate">Intermedio</MenuItem>
            <MenuItem value="advanced">Avanzato</MenuItem>
            <MenuItem value="expert">Esperto</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={2}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleResetFilters}
            sx={{ height: '100%' }}
          >
            Reset
          </Button>
        </Grid>
      </Grid>

      {/* Lista eventi */}
      {events.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: 'center', mt: 4 }}>
          Nessun evento trovato
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {events.map((event) => {
            const eventId = event.id;
            const eventTitle = event.title || 'Senza titolo';
            const eventImage = event.image_url;
            const eventDate = event.date;
            const eventLocation = event.location;
            const eventDifficulty = event.difficulty;

            return (
              <Card
                key={eventId}
                sx={{
                  width: '100%',
                  borderRadius: 2,
                  '&:hover': { boxShadow: 4 }
                }}
              >
                <CardActionArea
                  onClick={() => handleEventClick(eventId)}
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  {eventImage ? (
                    <CardMedia
                      component="img"
                      sx={{ width: 100, height: 80, objectFit: 'cover', flexShrink: 0 }}
                      image={eventImage}
                      alt={eventTitle}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 100,
                        height: 80,
                        bgcolor: 'primary.light',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <MusicNoteIcon sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                  )}

                  <CardContent sx={{ flex: 1, py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ flex: 1 }}>
                          {eventTitle}
                        </Typography>
                        {event.theme && (
                          <Chip
                            label={event.theme}
                            size="small"
                            color="primary"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <CalendarMonthIcon sx={{ fontSize: 14 }} color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {eventDate
                            ? format(new Date(eventDate), 'd MMM yyyy', { locale: it })
                            : 'N/D'}
                        </Typography>
                        <LocationOnIcon sx={{ fontSize: 14, ml: 1 }} color="action" />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {eventLocation || 'N/D'}
                        </Typography>
                      </Stack>

                      {(event.category || eventDifficulty) && (
                        <Stack direction="row" spacing={0.5}>
                          {event.category && (
                            <Chip
                              label={event.category}
                              size="small"
                              variant="outlined"
                              sx={{ height: 16, fontSize: 10 }}
                            />
                          )}
                          {eventDifficulty && (
                            <Chip
                              label={eventDifficulty}
                              size="small"
                              variant="outlined"
                              color="info"
                              sx={{ height: 16, fontSize: 10 }}
                            />
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>

                  <ChevronRightIcon sx={{ mr: 1, color: 'text.disabled' }} />
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
    </Container>
  );
};

export default EventList;