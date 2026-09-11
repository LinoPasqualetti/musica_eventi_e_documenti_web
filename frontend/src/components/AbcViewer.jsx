// src/components/AbcViewer.jsx — MULTI-TUNE + TRASPOSIZIONE + STRUMENTO + ZOOM
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Stack,
  Select, MenuItem, FormControl, InputLabel, Chip, Paper,
  List, ListItem, ListItemButton, ListItemText, Grid, Tooltip, IconButton
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';

const INSTRUMENTS = [
  { label: 'Strumento in Do (nessuna)', value: 0 },
  { label: 'Clarinetto in Sib', value: 2 },
  { label: 'Tromba in Sib', value: 2 },
  { label: 'Sax Soprano in Sib', value: 2 },
  { label: 'Sax Tenore in Sib', value: 14 },
  { label: 'Sax Contralto in Mib', value: 9 },
  { label: 'Sax Baritono in Mib', value: 21 },
  { label: 'Corno in Fa', value: 7 },
];

function splitAbcTunes(text) {
  const lines = text.split(/\r?\n/);
  const tunes = [];
  let current = [];
  for (const line of lines) {
    if (/^X:\s*\d+/i.test(line)) {
      if (current.length > 0) tunes.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) tunes.push(current.join('\n').trim());
  return tunes.filter((t) => t.trim().length > 0);
}

function parseTuneMeta(abcText) {
  const get = (field) => {
    const re = new RegExp(`^${field}:\\s*(.+)$`, 'mi');
    const m = abcText.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    title: get('T') || 'Senza titolo',
    composer: get('C') || '',
    rhythm: get('R') || '',
    meter: get('M') || '',
    key: get('K') || '',
  };
}

export default function AbcViewer({ contentUrl, fileName, fallbackTitle }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tunes, setTunes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [instrument, setInstrument] = useState(0);
  const [log, setLog] = useState([]);
  const [hasAudio, setHasAudio] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  const paperRef = useRef(null);
  const audioRef = useRef(null);
  const synthCtrlRef = useRef(null);

  const finalVisualTranspose = transpose + instrument;
  const finalMidiTranspose = transpose;

  const append = (msg) => {
    console.log('[AbcViewer]', msg);
    setLog((l) => [...l.slice(-50), msg]);
  };

  const stopAudio = () => {
    if (synthCtrlRef.current) {
      try { synthCtrlRef.current.pause(); } catch (e) { /* ignore */ }
      synthCtrlRef.current = null;
    }
    document.querySelectorAll('audio').forEach((a) => {
      try { a.pause(); } catch (_) {}
    });
  };

  // ---- 1. Carica il testo ABC ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    append(`Carico ${contentUrl}`);

    fetch(contentUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        append(`Ricevuti ${text.length} caratteri`);
        const parts = splitAbcTunes(text);
        const parsed = parts.map((t) => ({ text: t, meta: parseTuneMeta(t) }));

        // Se c'è UNA SOLA tune e non ha titolo, usa fallbackTitle (nome file)
        if (parsed.length === 1 && parsed[0].meta.title === 'Senza titolo' && fallbackTitle) {
          parsed[0].meta.title = fallbackTitle.replace(/\.(mxl|abc|xml|musicxml)$/i, '');
        }

        setTunes(parsed);
        append(`Trovate ${parsed.length} tune`);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(e.message || 'Errore caricamento ABC');
        append(`ERRORE: ${e.message}`);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl, fallbackTitle]);

  // ---- 2. Render della tune selezionata ----
  useEffect(() => {
    if (loading || tunes.length === 0) return;
    const tune = tunes[selectedIndex];
    if (!tune) return;

    try {
      if (synthCtrlRef.current) {
        try { synthCtrlRef.current.pause(); } catch (_) {}
        synthCtrlRef.current = null;
      }
      if (paperRef.current) paperRef.current.innerHTML = '';

      const renderOptions = {
        responsive: 'resize',
        staffwidth: 800,
        scale: 1.3 * zoom,
        add_classes: true,
        visualTranspose: finalVisualTranspose,
        wrap: {
          minSpacing: 1.8,
          maxSpacing: 2.7,
          preferredMeasuresPerLine: 4,
        },
        paddingtop: 0,
        paddingbottom: 0,
        paddingleft: 0,
        paddingright: 0,
      };

      const visualObjs = abcjs.renderAbc(paperRef.current, tune.text, renderOptions);
      append(`Render tune #${selectedIndex + 1} "${tune.meta.title}" (visual ${finalVisualTranspose}, midi ${finalMidiTranspose}, zoom ${zoom})`);

      const audioSupported = abcjs.synth?.supportsAudio?.();
      setHasAudio(!!audioSupported);

      if (audioSupported && visualObjs.length > 0 && audioRef.current) {
        audioRef.current.innerHTML = '';
        const ctrl = new abcjs.synth.SynthController();
        ctrl.load(audioRef.current, null, {
          displayRestart: true,
          displayPlay: true,
          displayProgress: true,
          displayWarp: true,
        });
        ctrl.setTune(visualObjs[0], false, {
          program: 0,
          midiTranspose: finalMidiTranspose,
        });
        synthCtrlRef.current = ctrl;
        append('Player audio collegato');
      }
    } catch (e) {
      console.error(e);
      setError('Errore render ABC: ' + e.message);
      append(`ERRORE render: ${e.message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunes, selectedIndex, finalVisualTranspose, finalMidiTranspose, loading, zoom]);

  // ---- 3. Cleanup ----
  useEffect(() => {
    return () => {
      append('Cleanup: fermo il synth');
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMeta = useMemo(
    () => (tunes[selectedIndex]?.meta || null),
    [tunes, selectedIndex]
  );

  const currentInstrumentLabel = INSTRUMENTS.find((i) => i.value === instrument)?.label;

  return (
    <Box sx={{ p: 2, width: '100%', color: 'white' }}>
      {/* Intestazione */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <MusicNoteIcon sx={{ color: '#ce93d8' }} />
        <Typography variant="h6" noWrap sx={{ flex: 1, color: 'white', fontWeight: 600 }}>
          {fileName}
        </Typography>
        <Chip
          label={`${tunes.length} bran${tunes.length === 1 ? 'o' : 'i'}`}
          size="small"
          sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.25)', fontWeight: 600 }}
        />
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, gap: 2 }}>
          <CircularProgress sx={{ color: '#ce93d8' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Caricamento file ABC…
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && tunes.length > 0 && (
        <Grid container spacing={2}>
          {/* ---- SIDEBAR: indice brani (bianco/celeste) ---- */}
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid rgba(0,0,0,0.15)',
                maxHeight: '75vh',
                overflowY: 'auto',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  p: 1.5,
                  color: 'white',
                  borderBottom: '2px solid #0288d1',
                  fontWeight: 700,
                  backgroundColor: '#0288d1',
                }}
              >
                📋 Indice ({tunes.length})
              </Typography>
              <List dense disablePadding>
                {tunes.map((t, i) => (
                  <ListItem key={i} disablePadding divider sx={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                    <ListItemButton
                      selected={i === selectedIndex}
                      onClick={() => setSelectedIndex(i)}
                      sx={{
                        py: 1,
                        backgroundColor: 'white',
                        color: 'black',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                        },
                        '&.Mui-selected': {
                          backgroundColor: '#b3e5fc',
                          color: 'black',
                          borderLeft: '4px solid #0288d1',
                          '&:hover': {
                            backgroundColor: '#81d4fa',
                          },
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            sx={{
                              color: 'black',
                              fontSize: 14,
                              fontWeight: i === selectedIndex ? 700 : 500,
                            }}
                            noWrap
                          >
                            {i + 1}. {t.meta.title}
                          </Typography>
                        }
                        secondary={
                          <Typography
                            sx={{ color: 'rgba(0,0,0,0.6)', fontSize: 12 }}
                            noWrap
                          >
                            {[t.meta.composer, t.meta.rhythm, t.meta.key]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* ---- AREA PRINCIPALE ---- */}
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                p: 1.5,
                mb: 2,
                backgroundColor: 'rgba(0,0,0,0.35)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: 'white' }}>
                  {currentMeta?.title || 'Senza titolo'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  {[currentMeta?.composer, currentMeta?.rhythm, currentMeta?.meter, currentMeta?.key]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 180, flex: '1 1 180px' }}>
                  <InputLabel id="transpose-label" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Tonalità (spartito + audio)
                  </InputLabel>
                  <Select
                    labelId="transpose-label"
                    label="Tonalità (spartito + audio)"
                    value={transpose}
                    onChange={(e) => setTranspose(e.target.value)}
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                      '& .MuiSvgIcon-root': { color: 'white' },
                    }}
                  >
                    {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n === 0 ? 'Originale (0)' : n > 0 ? `+${n} semitoni` : `${n} semitoni`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200, flex: '1 1 200px' }}>
                  <InputLabel id="instrument-label" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Strumento (solo lettura)
                  </InputLabel>
                  <Select
                    labelId="instrument-label"
                    label="Strumento (solo lettura)"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                      '& .MuiSvgIcon-root': { color: 'white' },
                    }}
                  >
                    {INSTRUMENTS.map((inst) => (
                      <MenuItem key={inst.label} value={inst.value}>
                        {inst.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Zoom controls */}
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 1,
                    px: 0.5,
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                >
                  <Tooltip title="Riduci">
                    <IconButton
                      size="small"
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                      sx={{ color: 'white' }}
                    >
                      <ZoomOutIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Chip
                    label={`${Math.round(zoom * 100)}%`}
                    size="small"
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      minWidth: 56,
                      justifyContent: 'center',
                    }}
                  />
                  <Tooltip title="Ingrandisci">
                    <IconButton
                      size="small"
                      onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
                      sx={{ color: 'white' }}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset 100%">
                    <IconButton
                      size="small"
                      onClick={() => setZoom(1.0)}
                      sx={{ color: 'white' }}
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={contentUrl}
                  download={fileName}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  Scarica
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                {transpose !== 0 && (
                  <Chip
                    label={`Tonalità ${transpose > 0 ? '+' : ''}${transpose}`}
                    size="small"
                    sx={{ color: 'white', backgroundColor: 'rgba(100,181,246,0.5)', fontWeight: 600 }}
                  />
                )}
                {instrument !== 0 && (
                  <Chip
                    label={`Lettura per ${currentInstrumentLabel}`}
                    size="small"
                    sx={{ color: 'black', backgroundColor: 'rgba(255,193,7,0.85)', fontWeight: 700 }}
                  />
                )}
                {transpose === 0 && instrument === 0 && (
                  <Chip
                    label="Nessuna trasposizione"
                    size="small"
                    sx={{ color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.15)' }}
                  />
                )}
              </Stack>

              {hasAudio && (
                <Box
                  ref={audioRef}
                  sx={{
                    mt: 1.5,
                    '& .abcjs-inline-audio': {
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1,
                      padding: '6px',
                    },
                  }}
                />
              )}
            </Paper>

            <Box
              sx={{
                backgroundColor: 'white',
                borderRadius: 1,
                border: '2px solid rgba(255,255,255,0.3)',
                minHeight: 400,
                maxHeight: '70vh',
                overflow: 'auto',
                p: 2,
                '& svg': { maxWidth: '100%', height: 'auto', display: 'block' },
                '& svg path, & svg text, & svg .abcjs-note, & svg .abcjs-staff': {
                  fill: 'black',
                  stroke: 'black',
                },
              }}
            >
              <Box
                ref={paperRef}
                sx={{
                  minHeight: 300,
                  '& svg': { maxWidth: '100%', height: 'auto', display: 'block' },
                }}
              />
            </Box>
          </Grid>
        </Grid>
      )}

      {!loading && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>
            Log diagnostico ({log.length})
          </summary>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#111', color: '#0f0',
              p: 2, borderRadius: 1, fontSize: 11,
              fontFamily: 'monospace', maxHeight: 200,
              overflowY: 'auto', whiteSpace: 'pre-wrap', mt: 1,
            }}
          >
            {log.join('\n') || '(nessun log)'}
          </Box>
        </details>
      )}
    </Box>
  );
}