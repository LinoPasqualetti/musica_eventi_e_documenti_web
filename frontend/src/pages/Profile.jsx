// src/pages/Profile.jsx
import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Alert, Box,
  CircularProgress, Grid,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setProfileLoading(true);
    const res = await updateProfile({ full_name: fullName, bio });
    setProfileLoading(false);
    if (res.ok) {
      setProfileMsg({ type: 'success', text: 'Profilo aggiornato' });
    } else {
      setProfileMsg({ type: 'error', text: res.error });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'La nuova password deve avere almeno 8 caratteri' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Le nuove password non coincidono' });
      return;
    }

    setPwLoading(true);
    const res = await changePassword({ old_password: oldPassword, new_password: newPassword });
    setPwLoading(false);

    if (res.ok) {
      setPwMsg({ type: 'success', text: 'Password aggiornata' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwMsg({ type: 'error', text: res.error });
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        👤 Il mio profilo
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📇 Dati personali
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Email: <strong>{user?.email}</strong>
            </Typography>

            {profileMsg.text && (
              <Alert severity={profileMsg.type || 'info'} sx={{ mb: 2 }}>
                {profileMsg.text}
              </Alert>
            )}

            <Box component="form" onSubmit={handleProfileSave}>
              <TextField
                label="Nome e cognome"
                fullWidth
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Bio"
                fullWidth
                multiline
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Es. Chitarrista jazz, suono da 10 anni"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={profileLoading}
                startIcon={profileLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                Salva modifiche
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              🔒 Cambia password
            </Typography>

            {pwMsg.text && (
              <Alert severity={pwMsg.type || 'info'} sx={{ mb: 2 }}>
                {pwMsg.text}
              </Alert>
            )}

            <Box component="form" onSubmit={handlePasswordChange}>
              <TextField
                label="Vecchia password"
                type="password"
                fullWidth
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Nuova password"
                type="password"
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Almeno 8 caratteri"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Conferma nuova password"
                type="password"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="outlined"
                disabled={pwLoading}
                startIcon={pwLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                Cambia password
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
