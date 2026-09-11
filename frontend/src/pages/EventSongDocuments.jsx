// src/pages/EventSongDocuments.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Button, Paper, Box, CircularProgress, Alert,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Chip, Stack, Divider, Avatar, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import DocumentViewer from '../components/DocumentViewer';
import { eventService } from '../services/api';

const API_BASE = 'http://localhost:5000/api';

function iconFor(doc) {
  const ext = (doc.file_name || '').split('.').pop().toLowerCase();
  const t = (doc.doc_type || '').toLowerCase();
  if (t === 'pdf' || ext === 'pdf') return <PictureAsPdfIcon sx={{ color: '#ef5350' }} />;
  if (t === 'mid' || t === 'kar' || ext === 'mid' || ext === 'kar') return <MusicNoteIcon sx={{ color: '#7e57c2' }} />;
  if (t === 'mxl' || ext === 'mxl' || ext === 'xml') return <DescriptionIcon sx={{ color: '#42a5f5' }} />;
  if (t === 'abc' || ext === 'abc') return <DescriptionIcon sx={{ color: '#26a69a' }} />;
  if (['mp3','wav','ogg','m4a'].includes(ext) || t.startsWith('audio')) return <AudiotrackIcon sx={{ color: '#ffa726' }} />;
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext) || t === 'image') return <ImageIcon sx={{ color: '#66bb6a' }} />;
  return <InsertDriveFileIcon sx={{ color: '#90a4ae' }} />;
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EventSongDocuments() {
  const { id: eventId, songId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, songId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventService.getById(eventId);
      const data = res.data?.data ?? res.data;
      setEvent(data);
      const foundSong = (data?.songs || []).find((s) => String(s.id) === String(songId));
      if (!foundSong) throw new Error('Brano non trovato in questo evento');
      setSong(foundSong);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  const documents = useMemo(() => {
    if (!song) return [];
    // Il backend restituisce song.documents[] con doc_type, file_name, etc.
    // Li ordiniamo per SongDocument.order_index se disponibile, poi per created_at.
    const docs = [...(song.documents || [])];
    docs.sort((a, b) => {
      const oa = a.SongDocument?.order_index ?? 0;
      const ob = b.SongDocument?.order_index ?? 0;
      return oa - ob;
    });
    return docs;
  }, [song]);

  const openViewer = (doc) => {
    setViewerDoc(doc);
    setViewerOpen(true);
  };

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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/event/${eventId}`)} sx={{ mt: 2 }}>
          Torna all'evento
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/event/${eventId}`)}
        sx={{ mb: 2 }}
      >
        Torna all'evento
      </Button>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <MusicNoteIcon sx={{ color: '#7e57c2' }} />
          <Typography variant="h5" sx={{ flex: 1, fontWeight: 600 }}>
            {song?.title}
          </Typography>
          <Tooltip title="Aggiorna">
            <IconButton onClick={loadData}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
        {song?.composer && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {song.composer}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            📄 Documenti per questo brano
          </Typography>
          <Chip
            label={`${documents.length} document${documents.length === 1 ? 'o' : 'i'}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        {documents.length === 0 ? (
          <Box
            sx={{
              p: 3, textAlign: 'center',
              backgroundColor: '#f5f5f5', borderRadius: 1,
            }}
          >
            <Typography color="text.secondary">
              Nessun documento associato a questo brano per l'evento corrente.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {documents.map((doc, index) => {
              const contentUrl = `${API_BASE}/documents/${doc.id}/content`;
              return (
                <ListItem
                  key={doc.id}
                  disablePadding
                  divider
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Visualizza">
                        <IconButton color="primary" onClick={() => openViewer(doc)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Apri in nuova scheda">
                        <IconButton
                          component="a"
                          href={contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <OpenInNewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Scarica">
                        <IconButton
                          component="a"
                          href={contentUrl}
                          download={doc.file_name}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemButton onClick={() => openViewer(doc)}>
                    <ListItemIcon sx={{ minWidth: 44 }}>
                      <Avatar sx={{ bgcolor: 'transparent', width: 32, height: 32 }}>
                        {iconFor(doc)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 500 }} noWrap>
                            {index + 1}. {doc.file_name}
                          </Typography>
                          <Chip
                            label={doc.doc_type || '?'}
                            size="small"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack direction="column">
                          {doc.description && (
                            <Typography variant="caption" noWrap>
                              {doc.description}
                            </Typography>
                          )}
                          {doc.file_size ? (
                            <Typography variant="caption" color="text.disabled">
                              {formatSize(doc.file_size)}
                            </Typography>
                          ) : null}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>

      <DocumentViewer
        document={viewerDoc}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </Container>
  );
}