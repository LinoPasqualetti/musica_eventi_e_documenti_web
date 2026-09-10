// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import EventList from './pages/EventList';
import EventDetail from './pages/EventDetail';
import EventSongsAssignment from './pages/EventSongsAssignment';
import EventSetlist from './pages/EventSetlist';
import EventSongDocuments from './pages/EventSongDocuments';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' }
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/event/:id/songs" element={<EventSongsAssignment />} />
          <Route path="/event/:id/setlist" element={<EventSetlist />} />
          <Route path="/event/:id/song/:songId" element={<EventSongDocuments />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;