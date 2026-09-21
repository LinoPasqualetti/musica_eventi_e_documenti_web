// src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, Typography, TextField, Button, Alert, Box, Link,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password) {
      setError('Compila tutti i campi obbligatori');
      return;
    }
    if (!email.includes('@')) {
      setError('Inserisci un email valida');
      return;
    }
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Le password non coincidono');
      return;
    }

    setLoading(true);
    const res = await register({
      email: email.trim().toLowerCase(),
      password,
      full_name: fullName.trim(),
    });
    setLoading(false);

    if (res.ok) {
      navigate(redirectTo, { replace: true });
    } else {
      setError(res.error);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 6, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          🎵 Crea il tuo account
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
          Basta qualche dato per iniziare
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <TextField
            label="Nome e cognome"
            fullWidth
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            helperText="Almeno 8 caratteri"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Conferma password"
            type="password"
            fullWidth
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {loading ? 'Registrazione in corso...' : 'Crea account'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2">
            Hai gia un account?{' '}
            <Link component={RouterLink} to={`/login?redirect=${encodeURIComponent(redirectTo)}`}>
              Accedi
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
