// src/components/AppHeader.jsx
import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Box, Avatar, Menu, MenuItem,
  IconButton, Tooltip, Divider,
} from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../context/AuthContext';
import ListAltIcon from '@mui/icons-material/ListAlt';

export default function AppHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);
  const handleOpenMenu = (e) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleLogout = () => {
    handleCloseMenu();
    logout();
    navigate('/');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            flexGrow: 1,
          }}
        >
          <MusicNoteIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div">
            Musica per Tutti
          </Typography>
        </Box>

        {isAuthenticated ? (
          <>
            <Tooltip title="Il mio profilo">
              <IconButton onClick={handleOpenMenu} sx={{ p: 0.5 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleCloseMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  {user.full_name} ({user.email})
                </Typography>
              </MenuItem>
              <Divider />

              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  navigate('/mie-candidature');
                }}
              >
                <ListAltIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2">Le mie candidature</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Gestisci le tue candidature
                  </Typography>
                </Box>
              </MenuItem>

              <Divider />

              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  navigate('/profile');
                }}
              >
                <PersonIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2">Profilo</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Modifica i tuoi dati
                  </Typography>
                </Box>
              </MenuItem>

              <Divider />

              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5, color: 'error.main' }} />
                <Typography variant="body2" color="error">Esci</Typography>
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Box>
            <Button
              color="inherit"
              startIcon={<AccountCircleIcon />}
              onClick={() => navigate('/login')}
            >
              Accedi
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => navigate('/register')}
              sx={{ ml: 1 }}
            >
              Registrati
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
