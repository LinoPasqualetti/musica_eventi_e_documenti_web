// src/pages/EventDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Container,
  Chip,
  Stack
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShareIcon from '@mui/icons-material/Share';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { eventService } from '../services/api';

  const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [event, setEvent] = useState(null);
  const [songs, setSongs] = useState([]);
  const [docCounts, setDocCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEventDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const eventResponse = await eventService.getById(id);
      const eventData = eventResponse.data?.data ?? eventResponse.data;
      setEvent(eventData);

      try {
        const songsResponse = await eventService.getSongs(id);
        const songsData = songsResponse.data?.data ?? songsResponse.data ?? [];
        setSongs(Array.isArray(songsData) ? songsData : []);
      } catch (songErr) {
        console.log('ℹ️ Nessun brano associato a questo evento');
        setSongs([]);
      }

      try {
        const countsResponse = await eventService.getDocumentCounts(id);
        const countsData = countsResponse.data?.data ?? countsResponse.data ?? {};
        setDocCounts(typeof countsData === 'object' ? countsData : {});
      } catch (countErr) {
        console.log('ℹ️ Nessun conteggio documenti disponibile');
        setDocCounts({});
      }
    } catch (err) {
      console.error('❌ Errore dettaglio evento:', err);
      setError('Errore durante il caricamento dei dettagli dell\'evento');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => loadEventDetails();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event?.title,
        text: event?.theme,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiato negli appunti');
    }
  };

  const handleOpenSetlist = () => {
    navigate(`/event/${id}/setlist`);
  };

  const handleOpenSong = (songId) => {
    navigate(`/event/${id}/song/${songId}`);
  };
  const handleCandidatura = (songId) => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/candidatura/${id}/${songId}`);
    } else {
      navigate(`/candidatura/${id}/${songId}`);
    }
  };

  // ------------------------------------------------------------
  // Stati di caricamento / errore
  // ------------------------------------------------------------
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress sx={{ color: '#7e57c2' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button component={Link} to="/" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Torna agli eventi
        </Button>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Evento non trovato</Alert>
        <Button component={Link} to="/" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Torna agli eventi
        </Button>
      </Container>
    );
  }

  // ------------------------------------------------------------
  // Variabili di layout
  // ------------------------------------------------------------
  const hasImage = event.image_url && event.image_url.trim().length > 0;
  const formattedDate = event.date
    ? format(new Date(event.date), 'd MMMM yyyy', { locale: it })
    : 'Data non specificata';
  const isPast = event.date ? new Date(event.date) < new Date() : false;
  const isPublished = event.status === 'published';
  const needsScroll = songs.length > 20;

  // Stile comune ai pulsanti chip del desktop
  const chipButtonStyle = {
    color: 'white',
    fontSize: 11,
    minWidth: 0,
    px: 1.25,
    py: 0.5,
    textTransform: 'none',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.25)',
      boxShadow: 'none'
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        backgroundImage: hasImage ? `url(${event.image_url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#7e57c2',
        '&::before': hasImage
          ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))',
              pointerEvents: 'none'
            }
          : {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #7e57c2, #4527a0)',
              pointerEvents: 'none'
            }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* -------------------------------------------------- */}
        {/* AppBar interna                                     */}
        {/* -------------------------------------------------- */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1 }}>
          <IconButton onClick={() => navigate('/')} sx={{ color: 'white' }} aria-label="Torna indietro">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={handleRefresh} sx={{ color: 'white' }} aria-label="Aggiorna">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={handleShare} sx={{ color: 'white' }} aria-label="Condividi">
            <ShareIcon />
          </IconButton>
        </Box>

        {/* -------------------------------------------------- */}
        {/* Blocco info evento                                 */}
        {/* -------------------------------------------------- */}
        <Box sx={{ flex: 2, px: 2, pt: 0, pb: 0.5 }}>
          <Typography
            variant="h4"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: { xs: 22, md: 28 },
              textShadow: '0 2px 10px rgba(0,0,0,0.54)',
              mb: 0.5
            }}
          >
            {event.title}
          </Typography>

          <Box
            sx={{
              display: 'inline-block',
              px: 1,
              py: 0.25,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 3,
              mb: 0.75
            }}
          >
            <Typography sx={{ color: 'white', fontSize: 11, fontWeight: 500 }}>
              {event.theme}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
            <CalendarTodayIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              {formattedDate}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <LocationOnIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }} />
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {event.location || 'Luogo non specificato'}
            </Typography>
          </Stack>

          {event.description && event.description.trim().length > 0 && (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                lineHeight: 1.3,
                mt: 0.75,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {event.description}
            </Typography>
          )}

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            {event.category && (
              <Chip
                label={event.category}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)'
                }}
              />
            )}
            {event.difficulty && (
              <Chip
                label={event.difficulty}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)'
                }}
              />
            )}
          </Stack>
        </Box>

        {/* -------------------------------------------------- */}
        {/* Blocco scaletta (fondo)                            */}
        {/* -------------------------------------------------- */}
        <Box
          sx={{
            px: 1.5,
            pt: 0.25,
            pb: 1,
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 6%)'
          }}
        >
          {/* Intestazione scaletta con pulsanti chip */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 0.5, py: 0.5, flexWrap: 'wrap', gap: 1 }}
          >
            <Button
              size="small"
              startIcon={<PlaylistAddIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                // TODO: quando ci sarà l'admin nel web, navigherà a /event/:id/songs
                alert('Gestione scaletta disponibile solo nell\'app desktop');
              }}
              sx={chipButtonStyle}
            >
              Gestisci Scaletta ({songs.length})
            </Button>

            <Button
              size="small"
              startIcon={<FolderIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                alert('Gestione documenti disponibile solo nell\'app desktop');
              }}
              sx={chipButtonStyle}
            >
              Gestisci Documenti
            </Button>

            <Box sx={{ flex: 1 }} />

            <Button
              size="small"
              startIcon={<ListAltIcon sx={{ fontSize: 14 }} />}
              onClick={handleOpenSetlist}
              sx={{
                ...chipButtonStyle,
                border: '1px solid rgba(255,255,255,0.3)',
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderColor: 'rgba(255,255,255,0.6)'
                }
              }}
            >
              Apri scaletta
            </Button>
          </Stack>

          {/* Lista brani compatta, 2 colonne, ogni brano cliccabile */}
          {songs.length === 0 ? (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 11,
                textAlign: 'center',
                py: 0.5
              }}
            >
              Nessun brano in scaletta
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 1.5,
                rowGap: 0.25,
                maxHeight: needsScroll ? '25vh' : 'none',
                overflowY: needsScroll ? 'auto' : 'visible',
                pr: needsScroll ? 0.5 : 0
              }}
            >
              {songs.map((song, index) => {
                const docCount = docCounts[song.id] || 0;
                return (
                  <Box
                    key={song.id || index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      minHeight: 26,
                      px: 0.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.08)'
                      }
                    }}
                  >
                    {/* Icona cartella (apre pagina documenti del brano) */}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSong(song.id);
                      }}
                      sx={{
                        p: 0,
                        minWidth: 0,
                        color: '#ffc107',
                        '&:hover': { color: '#ffb300' }
                      }}
                      title="Documenti del brano"
                    >
                      <FolderOpenIcon sx={{ fontSize: 14 }} />
                    </IconButton>

                    {/* Numero progressivo */}
                    <Typography
                      onClick={() => handleOpenSong(song.id)}
                      sx={{
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: 9,
                        fontWeight: 'bold',
                        width: 16,
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </Typography>

                    {/* Contatore documenti (solo se > 0) */}
                    {docCount > 0 && (
                      <Typography
                        onClick={() => handleOpenSong(song.id)}
                        sx={{
                          color: 'rgba(255,193,7,0.8)',
                          fontSize: 9,
                          fontWeight: 600,
                          ml: 0.5,
                          flexShrink: 0
                        }}
                      >
                        ({docCount})
                      </Typography>
                    )}
                    {/* Titolo brano (cliccabile) */}
                    <Typography
                      onClick={() => handleOpenSong(song.id)}
                      sx={{
                        color: 'white',
                        fontSize: 11,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        ml: 0.5
                      }}
                    >
                      {song.title}
                    </Typography>

                    {/* Pulsante candidati (piccolo) */}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCandidatura(song.id);
                      }}
                      sx={{
                        p: 0.25,
                        color: '#81c784',
                        '&:hover': { color: '#66bb6a' }
                      }}
                      title="Candidati per questo brano"
                    >
                      <PersonAddIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>

                );
              })}
            </Box>
          )}

          {/* Pulsante iscrizione */}
          <Box sx={{ pt: 0.5, pb: 1 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<MusicNoteIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                if (isPast) {
                  alert('⚠️ Questo evento è già passato');
                  return;
                }
                if (!isPublished) {
                  alert('🔒 Questo evento non è ancora pubblicato');
                  return;
                }
                alert('Funzione iscrizione non ancora disponibile nel web');
              }}
              sx={{
                backgroundColor: '#673ab7',
                color: 'white',
                fontSize: 12,
                py: 0.75,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#5e35b1', boxShadow: 'none' }
              }}
            >
              🎸 Voglio Suonare sul Palco!
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EventDetail;