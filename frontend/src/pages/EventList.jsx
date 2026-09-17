// src/pages/EventList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
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
        <Grid size={{ xs: 12, md: 4 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleResetFilters}
            sx={{ height: { xs: 'auto', md: '100%' } }}
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                  overflow: 'hidden',
                  '&:hover': { boxShadow: 4 }
                }}
              >
                <CardActionArea
                  onClick={() => handleEventClick(eventId)}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: 'stretch',
                  }}
                >
                  {/* Immagine come background-image: NON può fallire */}
                  <Box
                    sx={{
                      width: { xs: '100%', md: 140 },
                      height: { xs: 180, md: 100 },
                      minHeight: { xs: 180, md: 100 },
                      flexShrink: 0,
                      position: 'relative',
                      bgcolor: 'primary.light',
                      backgroundImage: eventImage ? `url("${eventImage}")` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Fallback icona se non c'è immagine */}
                    {!eventImage && (
                      <MusicNoteIcon sx={{ fontSize: 40, color: 'white' }} />
                    )}
                  </Box>

                  {/* Contenuto testuale */}
                  <CardContent
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      py: 1.5,
                      px: 2,
                      '&:last-child': { pb: 1.5 },
                    }}
                  >
                    <Stack spacing={0.5}>
                      {/* Titolo + Chip tema */}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {eventTitle}
                        </Typography>
                        {event.theme && (
                          <Chip
                            label={event.theme}
                            size="small"
                            color="primary"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              maxWidth: { xs: 100, md: 180 },
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              },
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </Stack>

                      {/* Data + luogo */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
                      >
                        <CalendarMonthIcon sx={{ fontSize: 14 }} color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {eventDate
                            ? format(new Date(eventDate), 'd MMM yyyy', { locale: it })
                            : 'N/D'}
                        </Typography>
                        <LocationOnIcon
                          sx={{ fontSize: 14, ml: { xs: 0, md: 1 } }}
                          color="action"
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: { xs: '100%', md: 200 },
                          }}
                        >
                          {eventLocation || 'N/D'}
                        </Typography>
                      </Stack>

                      {/* Categoria + difficoltà */}
                      {(event.category || eventDifficulty) && (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                          {event.category && (
                            <Chip
                              label={event.category}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          )}
                          {eventDifficulty && (
                            <Chip
                              label={eventDifficulty}
                              size="small"
                              variant="outlined"
                              color="info"
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>

                  {/* Chevron: nascosto su mobile, visibile su desktop */}
                  <ChevronRightIcon
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      mr: 1,
                      color: 'text.disabled',
                      alignSelf: 'center',
                    }}
                  />
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