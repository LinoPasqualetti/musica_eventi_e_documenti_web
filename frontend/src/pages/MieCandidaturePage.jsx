// src/pages/MieCandidaturePage.jsx
import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, Alert, Box, CircularProgress,
  Chip, Card, CardContent, Divider,
} from '@mui/material';
import { registrationService } from '../services/api';

const STATUS_LABELS = {
  pending:   { label: 'In attesa', color: 'warning' },
  confirmed: { label: 'Confermato', color: 'success' },
  rejected:  { label: 'Rifiutato', color: 'default' },
  waitlist:  { label: 'Lista d\'attesa', color: 'info' },
  cancelled: { label: 'Ritirato', color: 'default' },
};

export default function MieCandidaturePage() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await registrationService.getMine();
      // Il backend restituisce direttamente un array
      const data = Array.isArray(res.data) ? res.data : (res.data.registrations || []);
      setRegistrations(data);
      setLoading(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Errore nel caricamento');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Il messaggio viene personalizzato dopo il caricamento
    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      // Rimuove il parametro dall'URL
      window.history.replaceState({}, '', '/mie-candidature');
    }
    load();
  }, []);

  // Personalizza il messaggio quando le candidature sono caricate
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get('created');

    // Nessuna candidatura ancora caricata: esci
    if (registrations.length === 0) return;

    // Mostra il messaggio solo se è arrivato ?created=1 o se già c'è un successo
    if (created !== '1' && !successMsg) return;

    // Prendi la candidatura più recente (prima, ordinate DESC)
    const latest = registrations[0];

    // Ricava il nome
    const nome = latest.candidate_name || latest.candidateName || 'utente';

    // Ricava il brano
    const brano = latest.eventSong?.song?.title
      || latest.event?.title
      || 'questo brano';

    setSuccessMsg(`Candidatura di ${nome} per il brano "${brano}" inviata con successo!`);
  }, [registrations]);

  const handleWithdraw = async (id) => {
    if (!window.confirm('Vuoi ritirare questa candidatura?')) return;
    try {
      await registrationService.withdraw(id);
      setSuccessMsg('Candidatura ritirata');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Errore nel ritiro');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        📋 Le mie candidature
      </Typography>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {registrations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Non hai ancora nessuna candidatura.
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Vai agli eventi
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {registrations.map((r) => {
            const st = STATUS_LABELS[r.status] || { label: r.status, color: 'default' };
            const canWithdraw = r.status === 'pending' || r.status === 'waitlist';
            return (
              <Card key={r.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="h6">
                        {r.candidate_name}
                      </Typography>
                      {r.candidate_email && (
                        <Typography variant="caption" color="text.secondary">
                          {r.candidate_email}
                        </Typography>
                      )}
                    </Box>
                    <Chip label={st.label} color={st.color} size="small" />
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    🎼 <strong>Brano:</strong>{' '}
                    {r.organSlot?.organ?.eventSong?.song?.title
                      || r.song?.title
                      || r.eventSong?.song?.title
                      || '—'}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    🎭 <strong>Evento:</strong>{' '}
                    {r.event?.title
                      || r.organSlot?.organ?.eventSong?.event?.title
                      || '—'}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    🎺 <strong>Strumento:</strong> {r.organSlot?.instrument || '—'}
                  </Typography>
                  {r.time_description && (
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      ⏱ <strong>Quando:</strong> {r.time_description}
                    </Typography>
                  )}
                  {r.notes && (
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      📝 <strong>Note:</strong> {r.notes}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Creata il: {new Date(r.created_at).toLocaleDateString('it-IT')}
                  </Typography>

                  {canWithdraw && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleWithdraw(r.id)}
                      >
                        Ritira candidatura
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Container>
  );
}
