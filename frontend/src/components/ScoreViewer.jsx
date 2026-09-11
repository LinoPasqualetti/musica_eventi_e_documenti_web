// src/components/ScoreViewer.jsx — ABC + MXL con scrolling, battute/riga e Fix 1
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
import JSZip from 'jszip';
import abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';
import { parse as parseMusicXml, serializeAbc } from 'musicxml-io';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

// ---- Costanti ----
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

// 🔥 Stile CSS per forzare nero + evidenziazione nota
const SVG_FORCE_BLACK = {
  '& svg': { maxWidth: '100%', height: 'auto', display: 'block' },
  '& svg path': { fill: 'black', stroke: 'black' },
  '& svg text': { fill: 'black', stroke: 'none' },
  '& svg tspan': { fill: 'black', stroke: 'none' },
  '& svg line': { stroke: 'black' },
  '& svg rect': { stroke: 'black', fill: 'transparent' },
  '& svg polygon': { fill: 'black', stroke: 'black' },
  '& svg polyline': { stroke: 'black', fill: 'none' },
  '& svg ellipse': { fill: 'black', stroke: 'black' },
  '& svg circle': { fill: 'black', stroke: 'black' },
  '& svg g': { fill: 'black' },
  '& svg .abcjs-note': { fill: 'black', stroke: 'black' },
  '& svg .abcjs-rest': { fill: 'black', stroke: 'black' },
  '& svg .abcjs-staff': { stroke: 'black' },
  '& svg .abcjs-bar': { stroke: 'black' },
  '& svg .abcjs-ledger': { stroke: 'black' },
  '& svg .abcjs-stem': { stroke: 'black' },
  '& svg .abcjs-slur': { stroke: 'black', fill: 'none' },
  '& svg .abcjs-tie': { stroke: 'black', fill: 'none' },
  '& svg .abcjs-beam': { fill: 'black', stroke: 'black' },
  '& svg .abcjs-chord': { fill: 'black' },
  '& svg .abcjs-lyric': { fill: 'black' },
  '& svg .abcjs-key-signature': { fill: 'black' },
  '& svg .abcjs-time-signature': { fill: 'black' },
  '& svg .abcjs-clef': { fill: 'black', stroke: 'black' },
  '& svg .abcjs-note-playing': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .abcjs-note-playing path': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .abcjs-note-playing polygon': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .abcjs-note-playing ellipse': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .abcjs-note-playing circle': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .abcjs-highlight': { fill: '#1976d2 !important', stroke: '#1976d2 !important' },
  '& svg .vf-stavenote': { fill: 'black', stroke: 'black' },
  '& svg .vf-stem': { stroke: 'black' },
  '& svg .vf-notehead': { fill: 'black', stroke: 'black' },
  '& svg .vf-beam': { fill: 'black' },
};

// ---- Utility ----
function detectKind(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (ext === 'abc') return 'abc';
  if (ext === 'mxl' || ext === 'xml' || ext === 'musicxml') return 'mxl';
  return 'unknown';
}

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

async function extractMusicXmlFromMxl(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  let xmlPath = null;
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('string');
    const m = containerXml.match(/full-path="([^"]+)"/i);
    if (m) xmlPath = m[1];
  }
  if (!xmlPath) {
    const xmlFiles = Object.keys(zip.files).filter(
      (name) => name.toLowerCase().endsWith('.xml') && !name.startsWith('META-INF/')
    );
    if (xmlFiles.length === 0) throw new Error('Nessun XML nello ZIP');
    xmlPath = xmlFiles[0];
  }
  const f = zip.file(xmlPath);
  if (!f) throw new Error(`File ${xmlPath} non trovato`);
  return { xmlText: await f.async('string'), xmlPath };
}

// ============================================================
// Componente principale
// ============================================================
export default function ScoreViewer({ contentUrl, fileName, fallbackTitle }) {
  const kind = useMemo(() => detectKind(fileName), [fileName]);

  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);

  const [abcSource, setAbcSource] = useState(null);
  const [xmlSource, setXmlSource] = useState(null);
  const [abcFromMxl, setAbcFromMxl] = useState(null);

  const [engine, setEngine] = useState(null);

  const [transpose, setTranspose] = useState(0);
  const [instrument, setInstrument] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [measuresPerLine, setMeasuresPerLine] = useState(4);

  const [tunes, setTunes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const paperRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const audioRef = useRef(null);
  const synthCtrlRef = useRef(null);
  const osmdRef = useRef(null);

  const finalVisualTranspose = transpose + instrument;
  const finalMidiTranspose = transpose;

  const append = (msg) => {
    console.log('[ScoreViewer]', msg);
    setLog((l) => [...l.slice(-60), msg]);
  };

  // ============================================================
  // FASE 1 — Carica il file
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError(null);
    setAbcSource(null);
    setXmlSource(null);
    setAbcFromMxl(null);
    setEngine(null);
    setTunes([]);
    setSelectedIndex(0);
    append(`Carico ${fileName} (${kind})`);

    if (kind === 'abc') {
      fetch(contentUrl)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => {
          if (cancelled) return;
          append(`ABC ricevuto: ${text.length} caratteri`);
          const parts = splitAbcTunes(text);
          const parsed = parts.map((t) => ({ text: t, meta: parseTuneMeta(t) }));
          if (parsed.length === 1 && parsed[0].meta.title === 'Senza titolo' && fallbackTitle) {
            parsed[0].meta.title = fallbackTitle.replace(/\.(mxl|abc|xml|musicxml)$/i, '');
          }
          setTunes(parsed);
          setAbcSource(parsed[0]?.text || text);
          setEngine('abc');
          setPhase('ready');
          append(`Pronte ${parsed.length} tune`);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error(e);
          setError(e.message);
          append(`ERRORE: ${e.message}`);
          setPhase('error');
        });
    } else if (kind === 'mxl') {
      fetch(contentUrl)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(async (buffer) => {
          if (cancelled) return;
          append(`MXL ricevuto: ${buffer.byteLength} byte`);
          const { xmlText, xmlPath } = await extractMusicXmlFromMxl(buffer);
          if (cancelled) return;
          append(`XML estratto: ${xmlPath} (${xmlText.length} caratteri)`);
          setXmlSource(xmlText);

          try {
            const score = parseMusicXml(xmlText);
            const abc = serializeAbc(score);
            append(`Conversione ABC: ${abc.length} caratteri`);
            setAbcFromMxl(abc);
            setEngine('abc');
          } catch (e) {
            console.warn('Conversione ABC fallita:', e);
            append(`Conversione ABC fallita → uso OSMD: ${e.message}`);
            setEngine('osmd');
          }
          setPhase('ready');
        })
        .catch((e) => {
          if (cancelled) return;
          console.error(e);
          setError(e.message);
          append(`ERRORE: ${e.message}`);
          setPhase('error');
        });
    } else {
      setError(`Tipo file non supportato: ${fileName}`);
      setPhase('error');
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl, fileName, kind]);

  // ============================================================
  // FASE 2 — RENDER con abcjs + Fix 1 (container fresco)
  // ============================================================
  useEffect(() => {
    if (engine !== 'abc') return;
    if (phase !== 'ready') return;

    let effectiveAbc = null;
    if (kind === 'abc' && tunes[selectedIndex]) {
      effectiveAbc = tunes[selectedIndex].text;
    } else if (kind === 'mxl' && abcFromMxl) {
      effectiveAbc = abcFromMxl;
    }

    if (!effectiveAbc) return;
    if (!paperRef.current) return;

    if (synthCtrlRef.current) {
      try { synthCtrlRef.current.pause(); } catch (_) {}
      synthCtrlRef.current = null;
    }

    try {
      // 🔥 FIX 1: reset completo del container con nodo nuovo
      // (abcjs altrimenti riusa le opzioni del primo render)
      paperRef.current.innerHTML = '';
      const freshInner = document.createElement('div');
      freshInner.style.minHeight = '300px';
      paperRef.current.appendChild(freshInner);

      const renderOptions = {
        responsive: 'resize',
        staffwidth: 800,
        scale: 1.3 * zoom,
        add_classes: true,
        visualTranspose: finalVisualTranspose,
        wrap: {
          minSpacing: 1.8,
          maxSpacing: 2.7,
          preferredMeasuresPerLine: measuresPerLine,
        },
        paddingtop: 0,
        paddingbottom: 0,
        paddingleft: 0,
        paddingright: 0,
      };

      // 🔥 renderAbc riceve il nodo nuovo
      const visualObjs = abcjs.renderAbc(freshInner, effectiveAbc, renderOptions);
      append(`AbcRenderer OK (${visualObjs.length} tune, visual ${finalVisualTranspose}, midi ${finalMidiTranspose}, zoom ${zoom}, battute/riga ${measuresPerLine})`);

      const audioSupported = abcjs.synth?.supportsAudio?.();
      if (audioSupported && visualObjs.length > 0 && audioRef.current) {
        audioRef.current.innerHTML = '';

        const cursorControl = {
          onStart: () => {
            append('▶ Playback avviato (con evidenziazione e scrolling)');
          },
          onFinished: () => {
            append('⏹ Playback terminato');
            document.querySelectorAll('.abcjs-note-playing, .abcjs-highlight')
              .forEach((el) => el.classList.remove('abcjs-note-playing', 'abcjs-highlight'));
          },
          onEvent: (event) => {
            document.querySelectorAll('.abcjs-note-playing, .abcjs-highlight')
              .forEach((el) => el.classList.remove('abcjs-note-playing', 'abcjs-highlight'));

            if (event && event.elements && event.elements.length) {
              event.elements.forEach((group) => {
                const list = Array.isArray(group) ? group : [group];
                list.forEach((el) => {
                  if (!el) return;
                  const node = el.el || el;
                  if (node && node.classList) {
                    node.classList.add('abcjs-note-playing');
                  }
                });
              });
            }
          },
          onLineEnd: (lineEvent) => {
            if (scrollContainerRef.current && lineEvent && typeof lineEvent.top === 'number') {
              scrollContainerRef.current.scrollTo({
                top: Math.max(0, lineEvent.top - 40),
                behavior: 'smooth',
              });
            }
          },
        };

        const ctrl = new abcjs.synth.SynthController();
        ctrl.load(
          audioRef.current,
          cursorControl,
          {
            displayRestart: true,
            displayPlay: true,
            displayProgress: true,
            displayWarp: true,
          }
        );
        ctrl.setTune(visualObjs[0], false, {
          program: 0,
          midiTranspose: finalMidiTranspose,
        });
        synthCtrlRef.current = ctrl;
      }
    } catch (e) {
      console.error('[ScoreViewer] abcjs crash:', e);
      append(`⚠️ AbcRenderer crash: ${e.message}`);
      if (xmlSource) {
        append('Fallback su OSMD (XML originale disponibile)');
        setEngine('osmd');
      } else {
        setError(`Errore render ABC: ${e.message}`);
        setPhase('error');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, phase, kind, tunes, selectedIndex, abcFromMxl, finalVisualTranspose, finalMidiTranspose, zoom, measuresPerLine, xmlSource]);

  // ============================================================
  // FASE 3 — RENDER con OSMD (fallback)
  // ============================================================
  useEffect(() => {
    if (engine !== 'osmd') return;
    if (phase !== 'ready') return;
    if (!xmlSource) return;
    if (!paperRef.current) return;

    const render = async () => {
      try {
        paperRef.current.innerHTML = '';

        if (!osmdRef.current) {
          append('Creo OSMD…');
          osmdRef.current = new OpenSheetMusicDisplay(paperRef.current, {
            autoResize: true,
            backend: 'svg',
            drawTitle: true,
            drawComposer: true,
            drawLyricist: true,
            drawCredits: true,
            drawPartNames: true,
          });
        }

        append('Carico XML in OSMD…');
        await osmdRef.current.load(xmlSource);

        try {
          osmdRef.current.Sheet.Transpose = finalVisualTranspose;
        } catch (e) {
          append(`⚠️ Trasposizione non supportata: ${e.message}`);
        }

        osmdRef.current.render();
        append('OsmdRenderer OK (nota: evidenziazione e scrolling non disponibili su OSMD)');
      } catch (e) {
        console.error('[ScoreViewer] OSMD crash:', e);
        append(`⚠️ OsmdRenderer crash: ${e.message}`);
        setError(`Errore render OSMD: ${e.message}`);
        setPhase('error');
      }
    };

    const raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, phase, xmlSource, finalVisualTranspose]);

  // ============================================================
  // Cleanup
  // ============================================================
  useEffect(() => {
    return () => {
      append('Cleanup');
      if (synthCtrlRef.current) {
        try { synthCtrlRef.current.pause(); } catch (_) {}
        synthCtrlRef.current = null;
      }
      if (osmdRef.current) {
        try { osmdRef.current.clear(); } catch (_) {}
        osmdRef.current = null;
      }
      document.querySelectorAll('audio').forEach((a) => {
        try { a.pause(); } catch (_) {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMeta = useMemo(() => {
    if (kind === 'abc' && tunes[selectedIndex]) return tunes[selectedIndex].meta;
    if (kind === 'mxl') return { title: fallbackTitle || fileName, composer: '', rhythm: '', meter: '', key: '' };
    return null;
  }, [kind, tunes, selectedIndex, fallbackTitle, fileName]);

  const currentInstrumentLabel = INSTRUMENTS.find((i) => i.value === instrument)?.label;
  const showSidebar = kind === 'abc' && tunes.length > 1;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Box sx={{ p: 2, width: '100%', color: 'white' }}>
      {/* ---- LOG in alto ---- */}
      {phase !== 'loading' && (
        <details
          style={{
            marginBottom: 12,
            backgroundColor: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '6px 12px',
          }}
          open={phase === 'error'}
        >
          <summary
            style={{
              color: '#90caf9',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 0',
              userSelect: 'none',
            }}
          >
            🩺 Log diagnostico ({log.length}) {phase === 'error' ? '— errore!' : ''}
          </summary>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#111',
              color: '#0f0',
              p: 2,
              borderRadius: 1,
              fontSize: 11,
              fontFamily: 'monospace',
              maxHeight: 300,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              mt: 1,
              mb: 1,
            }}
          >
            {log.join('\n') || '(nessun log)'}
          </Box>
        </details>
      )}

      {/* Intestazione */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <MusicNoteIcon sx={{ color: '#ce93d8' }} />
        <Typography variant="h6" noWrap sx={{ flex: 1, color: 'white', fontWeight: 600 }}>
          {fileName}
        </Typography>
        <Chip
          label={kind === 'mxl' ? 'MXL' : 'ABC'}
          size="small"
          sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.25)', fontWeight: 600 }}
        />
        {engine && (
          <Chip
            label={`motore: ${engine}`}
            size="small"
            sx={{
              color: 'white',
              backgroundColor: engine === 'osmd' ? 'rgba(255,193,7,0.5)' : 'rgba(100,181,246,0.5)',
              fontWeight: 600,
            }}
          />
        )}
      </Stack>

      {phase === 'loading' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, gap: 2 }}>
          <CircularProgress sx={{ color: '#ce93d8' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Caricamento…
          </Typography>
        </Box>
      )}

      {phase === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {phase === 'ready' && (
        <Grid container spacing={2}>
          {/* ---- SIDEBAR ---- */}
          {showSidebar && (
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
                          '&:hover': { backgroundColor: '#f5f5f5' },
                          '&.Mui-selected': {
                            backgroundColor: '#b3e5fc',
                            color: 'black',
                            borderLeft: '4px solid #0288d1',
                            '&:hover': { backgroundColor: '#81d4fa' },
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
                            <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: 12 }} noWrap>
                              {[t.meta.composer, t.meta.rhythm, t.meta.key].filter(Boolean).join(' · ') || '—'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          )}

          {/* ---- AREA PRINCIPALE ---- */}
          <Grid item xs={12} md={showSidebar ? 8 : 12}>
            {/* Barra controlli */}
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

                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="mpl-label" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Battute / riga
                  </InputLabel>
                  <Select
                    labelId="mpl-label"
                    label="Battute / riga"
                    value={measuresPerLine}
                    onChange={(e) => setMeasuresPerLine(e.target.value)}
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                      '& .MuiSvgIcon-root': { color: 'white' },
                    }}
                  >
                    {[2, 3, 4, 5, 6, 8].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

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

              {/* Contenitore audio abcjs */}
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
            </Paper>

            {/* ---- AREA SPARTITO (con scroll container) ---- */}
            <Box
              ref={scrollContainerRef}
              sx={{
                backgroundColor: 'white',
                borderRadius: 1,
                border: '2px solid rgba(255,255,255,0.3)',
                minHeight: 400,
                maxHeight: '70vh',
                overflow: 'auto',
                p: 2,
                ...SVG_FORCE_BLACK,
              }}
            >
              <Box
                ref={paperRef}
                sx={{
                  minHeight: 300,
                  ...SVG_FORCE_BLACK,
                }}
              />
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}