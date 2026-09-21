// src/pages/CandidaturaPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, Typography, TextField, Button, Alert, Box, Link,
  CircularProgress, Radio, RadioGroup, FormControlLabel, FormControl,
  FormLabel, Divider, Chip, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../context/AuthContext';
import { registrationService, resolveEventSongId } from '../services/api';

const SECTION_LABELS = {
  ritmica: { emoji: '🥁', label: 'Ritmica' },
  armonica: { emoji: '🎹', label: 'Armonica' },
  solistica: { emoji: '🎺', label: 'Solistica' },
  orchestrale: { emoji: '🎻', label: 'Orchestrale' },
};

export default function CandidaturaPage() {
  const { eventId, songId } = useParams();
  const [eventSongId, setEventSongId] = useState(null);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [slotsData, setSlotsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [forThirdParty, setForThirdParty] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Precompila il nome se loggato e sta candidando per sé
  useEffect(() => {
    if (user && !forThirdParty) {
      setCandidateName(user.full_name || '');
      setCandidateEmail(user.email || '');
    }
  }, [user, forThirdParty]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // 1. Risolvi eventSongId da (eventId, songId)
        const idRes = await resolveEventSongId(eventId, songId);
        const resolvedEventSongId = idRes.data?.eventSongId;
        if (!resolvedEventSongId) {
          throw new Error('EventSong non trovato');
        }
        if (mounted) setEventSongId(resolvedEventSongId);

        // 2. Carica slot disponibili
        const res = await registrationService.getSlotsAvailability(resolvedEventSongId);
        if (mounted) {
          setSlotsData(res.data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e.response?.data?.error || e.message || 'Errore nel caricamento degli slot');
          setLoading(false);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [eventId, songId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      navigate(`/login?redirect=/candidatura/${eventId}/${songId}`);
      return;
    }
    if (!candidateName.trim()) {
      setError('Inserisci il nome del candidato');
      return;
    }
    if (!selectedSlot) {
      setError('Scegli uno slot');
      return;
    }

    setSubmitting(true);
    try {
      await registrationService.create({
        organ_slot_id: selectedSlot,
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail.trim() || null,
        time_description: timeDescription.trim() || null,
        notes: notes.trim() || null,
      });
      navigate('/mie-candidature?created=1');
    } catch (e) {
      const msg = e.response?.data?.error || 'Errore durante l\'invio';
      setError(msg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !slotsData) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Raggruppa slot per sezione
  const slotsBySection = {};
  for (const slot of slotsData?.slots || []) {
    if (!slotsBySection[slot.section]) slotsBySection[slot.section] = [];
    slotsBySection[slot.section].push(slot);
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          🎼 Candidatura
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Brano: <strong>{slotsData?.songTitle || 'Sconosciuto'}</strong>
        </Typography>

        {!isAuthenticated && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Devi <Link component={RouterLink} to={`/login?redirect=/candidatura/${eventId}/${songId}`}>accedere</Link> per candidarti.
            </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          {/* Chi sta suonando */}
          <Typography variant="h6" gutterBottom>
            👤 Per chi ti candidi?
          </Typography>
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <RadioGroup
              value={forThirdParty ? 'third' : 'self'}
              onChange={(e) => setForThirdParty(e.target.value === 'third')}
            >
              <FormControlLabel
                value="self"
                control={<Radio />}
                label={`Per me stesso${user ? ` (${user.full_name})` : ''}`}
                disabled={!isAuthenticated}
              />
              <FormControlLabel
                value="third"
                control={<Radio />}
                label="Per un'altra persona (allievo, ecc.)"
              />
            </RadioGroup>
          </FormControl>

          <TextField
            label="Nome del candidato *"
            fullWidth
            required
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            disabled={!isAuthenticated || !forThirdParty && !!user}
            helperText={
              forThirdParty
                ? 'Nome di chi suonerà'
                : 'Nome di chi suonerà (precompilato con il tuo nome)'
            }
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email del candidato (opzionale)"
            type="email"
            fullWidth
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
            helperText="Utile se diversa dalla tua"
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

          {/* Scelta slot */}
          <Typography variant="h6" gutterBottom>
            🎼 Scegli il tuo ruolo
          </Typography>

          {Object.keys(slotsBySection).length === 0 ? (
            <Alert severity="info">
              Nessuno slot disponibile per questo brano.
            </Alert>
          ) : (
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
              >
                {Object.entries(slotsBySection).map(([section, slots]) => {
                  const sec = SECTION_LABELS[section] || { emoji: '🎵', label: section };
                  return (
                    <Accordion key={section} defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 'bold' }}>
                          {sec.emoji} {sec.label.toUpperCase()}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {slots.map((slot) => {
                            const isFull = slot.available <= 0;
                            return (
                              <Box
                                key={slot.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: isFull ? 'grey.100' : 'transparent',
                                }}
                              >
                                <FormControlLabel
                                  value={slot.id}
                                  control={<Radio />}
                                  label={slot.instrument}
                                  disabled={isFull && false}
                                />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Chip
                                    label={`${slot.quantity} post${slot.quantity > 1 ? 'i' : 'o'}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  {slot.confirmed > 0 && (
                                    <Chip
                                      label={`${slot.confirmed} confermat${slot.confirmed > 1 ? 'i' : 'o'}`}
                                      size="small"
                                      color="success"
                                    />
                                  )}
                                  {slot.pending > 0 && (
                                    <Chip
                                      label={`${slot.pending} in attesa`}
                                      size="small"
                                      color="warning"
                                    />
                                  )}
                                  {slot.available === 0 && (
                                    <Chip
                                      label="Posti esauriti"
                                      size="small"
                                      color="default"
                                    />
                                  )}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </RadioGroup>
            </FormControl>
          )}

          <Divider sx={{ my: 3 }} />

          <TextField
            label="Quando suonerai? (opzionale)"
            fullWidth
            value={timeDescription}
            onChange={(e) => setTimeDescription(e.target.value)}
            placeholder="Es. Tutto il brano, 2 movimento, Chorus 3-5"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Note (opzionale)"
            fullWidth
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting || !isAuthenticated}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {submitting ? 'Invio in corso...' : 'Invia candidatura'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
