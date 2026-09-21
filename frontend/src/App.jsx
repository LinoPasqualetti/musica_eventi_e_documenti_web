// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import AppHeader from './components/AppHeader';
import ProtectedRoute from './components/ProtectedRoute';

import EventList from './pages/EventList';
import EventDetail from './pages/EventDetail';
import EventSongsAssignment from './pages/EventSongsAssignment';
import EventSetlist from './pages/EventSetlist';
import EventSongDocuments from './pages/EventSongDocuments';
import ViewerPage from './pages/ViewerPage';
import MxlViewerPage from './pages/MxlViewerPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CandidaturaPage from './pages/CandidaturaPage';
import MieCandidaturePage from './pages/MieCandidaturePage';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppHeader />
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/event/:id/songs" element={<EventSongsAssignment />} />
          <Route path="/event/:id/setlist" element={<EventSetlist />} />
          <Route path="/event/:id/song/:songId" element={<EventSongDocuments />} />
          <Route path="/viewer" element={<ViewerPage />} />
          <Route path="/mxl-viewer" element={<MxlViewerPage />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidatura/:eventId/:songId"
            element={
              <ProtectedRoute>
                <CandidaturaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mie-candidature"
            element={
              <ProtectedRoute>
                <MieCandidaturePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
// ─── Helper: risolve eventSongId da (eventId, songId) ────────────────
export const resolveEventSongId = (eventId, songId) =>
  api.get(`/events/${eventId}/songs/${songId}/event-song-id`);
export default App;
