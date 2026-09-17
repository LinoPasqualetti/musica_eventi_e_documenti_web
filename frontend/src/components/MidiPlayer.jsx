// src/components/MidiPlayer.jsx — midi-audio-player + GeneralUser GS + Karaoke
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Slider, Stack, CircularProgress,
  Alert, Chip, Tooltip, Divider, FormControl, InputLabel, Select, MenuItem,
  Switch, FormControlLabel, Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import { MidiAudioPlayer } from 'midi-audio-player';

const SOUNDFONT_ENDPOINT = '/soundfonts/generaluser/';

const EQ_PRESETS = [
  { value: 'flat', label: 'Flat' },
  { value: 'classical', label: 'Classical' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'bass', label: 'Bass Boost' },
  { value: 'treble', label: 'Treble Boost' },
  { value: 'loudness', label: 'Loudness' },
];

export default function MidiPlayer({ contentUrl, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [reverb, setReverb] = useState(0.25);
  const [eqPreset, setEqPreset] = useState('flat');
  const [log, setLog] = useState([]);
  const [ready, setReady] = useState(false);

  // Karaoke
  const [karaokeEnabled, setKaraokeEnabled] = useState(false);
  const [karaokeFrame, setKaraokeFrame] = useState('');
  const [hasKaraoke, setHasKaraoke] = useState(false);

  const playerRef = useRef(null);
  const rafRef = useRef(null);
  const karaokeEnabledRef = useRef(karaokeEnabled);

  useEffect(() => {
    karaokeEnabledRef.current = karaokeEnabled;
  }, [karaokeEnabled]);

  const append = useCallback((msg) => {
    console.log('[MidiPlayer]', msg);
    const ts = new Date().toLocaleTimeString();
    const important = /pronto|caricato|Playback|ERRORE|FALLITO|fine|ready|creato|karaoke/i.test(msg);
    setLog((l) => [...l, `${important ? '⭐' : '  '} [${ts}] ${msg}`]);
  }, []);

  // ============================================================
  // 1. Inizializza il player
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    try {
      append('Creo MidiAudioPlayer…');
      const player = new MidiAudioPlayer({
        endpoint: SOUNDFONT_ENDPOINT,
        volume,
        reverb,
        eqPreset,
        localCache: true,
        karaoke: true,
        muteExpression: false,
      });

      player.on('computed', (info) => {
        if (cancelled) return;
        append(`File: "${info.title || fileName}" — ${info.duration?.toFixed(1)}s`);
        setDuration(info.duration || 0);
        if (info.karaoke) {
          setHasKaraoke(true);
          append('Karaoke rilevato nel file');
        }
      });

      player.on('presetsLoaded', () => {
        if (cancelled) return;
        append('Preset caricati');
        setReady(true);
      });

      player.on('endOfFile', () => {
        if (cancelled) return;
        append('Fine file');
        setPlaying(false);
        setCurrentTime(0);
        setKaraokeFrame('');
      });

      const handleKaraokeFrame = (frame) => {
        if (!karaokeEnabledRef.current) return;
        if (!frame) return;

        let html = '';
        if (typeof frame === 'string') html = frame;
        else if (frame.html) html = frame.html;
        else if (frame.text) html = frame.text;
        else if (frame.type && frame.content) html = frame.content;

        if (html) setKaraokeFrame(html);
      };

      player.on('karaoke', handleKaraokeFrame);
      player.on('karaokeFrame', handleKaraokeFrame);
      player.on('lyrics', handleKaraokeFrame);

      player.on('logs', (msg) => {
        console.log('[midi-audio-player]', msg);
        if (typeof msg === 'string' && /karaoke|lyric/i.test(msg)) {
          append(`[lib] ${msg}`);
        }
      });

      playerRef.current = player;
      append('MidiAudioPlayer creato');
    } catch (e) {
      console.error(e);
      setError(e.message);
      append(`ERRORE init: ${e.message}`);
    }

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try { playerRef.current.stop(); } catch (_) {}
        try { playerRef.current.close(); } catch (_) {}
        playerRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // 2. Carica il file MIDI
  // ============================================================
  useEffect(() => {
    if (!playerRef.current) return;
    if (!contentUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);
    setHasKaraoke(false);
    setKaraokeFrame('');
    setKaraokeEnabled(false);

    append(`Carico ${contentUrl}`);

    playerRef.current
      .load(contentUrl)
      .then(() => {
        if (cancelled) return;
        append('File caricato');
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(e.message || 'Errore caricamento MIDI');
        append(`ERRORE: ${e.message}`);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl]);

  // ============================================================
  // 3. RAF per posizione
  // ============================================================
  const startRaf = () => {
    const tick = () => {
      const player = playerRef.current;
      if (!player) return;
      const t = player.currentTime || 0;
      setCurrentTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // ============================================================
  // 4. Play/Pause
  // ============================================================
  const handlePlayPause = async () => {
    const player = playerRef.current;
    if (!player) return;

    if (playing) {
      await player.pause();
      setPlaying(false);
      stopRaf();
      append('Pausa');
    } else {
      await player.play();
      setPlaying(true);
      startRaf();
      append('Playback avviato');
    }
  };

  // ============================================================
  // 5. Stop
  // ============================================================
  const handleStop = async () => {
    const player = playerRef.current;
    if (!player) return;
    await player.stop();
    setCurrentTime(0);
    setPlaying(false);
    setKaraokeFrame('');
    stopRaf();
    append('Stop');
  };

  // ============================================================
  // 6. Seek
  // ============================================================
  const handleSeek = async (_, value) => {
    const player = playerRef.current;
    if (!player) return;
    const t = typeof value === 'number' ? value : 0;
    setCurrentTime(t);
    if (player.skipToSeconds) {
      try { await player.skipToSeconds(t); } catch (_) {}
    }
  };

  // ============================================================
  // 7. Volume
  // ============================================================
  const handleVolume = (_, value) => {
    const v = typeof value === 'number' ? value : 0.7;
    setVolume(v);
    if (playerRef.current) playerRef.current.volume = v;
  };

  // ============================================================
  // 8. Reverb
  // ============================================================
  const handleReverb = (_, value) => {
    const v = typeof value === 'number' ? value : 0.25;
    setReverb(v);
    if (playerRef.current) playerRef.current.reverb = v;
  };

  // ============================================================
  // 9. EQ
  // ============================================================
  const handleEqChange = (e) => {
    const v = e.target.value;
    setEqPreset(v);
    if (playerRef.current && playerRef.current.setEQPreset) {
      try { playerRef.current.setEQPreset(v); } catch (_) {}
      append(`EQ: ${v}`);
    }
  };

  // ============================================================
  // 10. Toggle karaoke
  // ============================================================
  const handleToggleKaraoke = (e) => {
    const enabled = e.target.checked;
    setKaraokeEnabled(enabled);
    if (!enabled) {
      setKaraokeFrame('');
    } else {
      append('Karaoke attivato');
    }
  };

  // ============================================================
  // 11. Formato tempo
  // ============================================================
  const fmt = (sec) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto', width: '100%' }}>
      <Typography variant="h6" sx={{ color: 'white', mb: 1 }} noWrap>
        {fileName}
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, gap: 2 }}>
          <CircularProgress sx={{ color: '#9575cd' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Caricamento file MIDI…
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <>
          {/* Barra principale */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <IconButton
              onClick={handlePlayPause}
              sx={{
                backgroundColor: '#673ab7', color: 'white',
                '&:hover': { backgroundColor: '#5e35b1' },
                width: 56, height: 56,
              }}
            >
              {playing ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
            </IconButton>

            <IconButton onClick={handleStop} sx={{ color: 'white' }}>
              <StopIcon />
            </IconButton>

            <Typography sx={{ color: 'white', fontSize: 13, minWidth: 40 }}>
              {fmt(currentTime)}
            </Typography>

            <Slider
              value={currentTime}
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              onChange={handleSeek}
              sx={{ color: '#9575cd', flex: 1 }}
            />

            <Typography sx={{ color: 'white', fontSize: 13, minWidth: 40 }}>
              {fmt(duration)}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', my: 2 }} />

          {/* Controlli audio */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
              <VolumeUpIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
              <Slider
                value={volume}
                min={0}
                max={1}
                step={0.05}
                onChange={handleVolume}
                sx={{ color: '#9575cd', width: 120 }}
              />
              <Typography sx={{ color: 'white', fontSize: 11, minWidth: 30 }}>
                {Math.round(volume * 100)}%
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                Riverbero
              </Typography>
              <Slider
                value={reverb}
                min={0}
                max={1}
                step={0.05}
                onChange={handleReverb}
                sx={{ color: '#9575cd', width: 120 }}
              />
              <Typography sx={{ color: 'white', fontSize: 11, minWidth: 30 }}>
                {Math.round(reverb * 100)}%
              </Typography>
            </Stack>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="eq-label" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                EQ
              </InputLabel>
              <Select
                labelId="eq-label"
                label="EQ"
                value={eqPreset}
                onChange={handleEqChange}
                sx={{
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                  '& .MuiSvgIcon-root': { color: 'white' },
                }}
              >
                {EQ_PRESETS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Toggle karaoke */}
            <FormControlLabel
              control={
                <Switch
                  checked={karaokeEnabled}
                  onChange={handleToggleKaraoke}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#ce93d8' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#9575cd',
                    },
                  }}
                />
              }
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MicIcon sx={{ color: karaokeEnabled ? '#ce93d8' : 'rgba(255,255,255,0.5)', fontSize: 18 }} />
                  <Typography sx={{ color: 'white', fontSize: 13 }}>
                    Karaoke
                  </Typography>
                  {hasKaraoke && (
                    <Chip
                      label="presente"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: 9,
                        color: 'white',
                        backgroundColor: 'rgba(100,181,246,0.6)',
                      }}
                    />
                  )}
                </Stack>
              }
            />
          </Stack>

          {/* 🔥 Box karaoke: sfondo blu, testo bianco */}
          {karaokeEnabled && (
            <Paper
              sx={{
                mt: 2,
                mb: 2,
                p: 3,
                minHeight: 100,
                backgroundColor: '#0D47A1',          // blu scuro
                border: '2px solid #1976d2',         // blu MUI primary
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(25,118,210,0.4)',
              }}
            >
              {karaokeFrame ? (
                <Box
                  sx={{
                    color: '#FFFFFF',                 // testo bianco
                    fontSize: 22,
                    fontWeight: 600,
                    lineHeight: 1.7,
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                    '& .karaoke-played': {
                      color: 'rgba(255,255,255,0.45)',   // bianco sbiadito (già cantato)
                    },
                    '& .karaoke-playing': {
                      color: '#FFEB3B',                  // giallo acceso (sillaba corrente)
                      backgroundColor: 'rgba(255,235,59,0.15)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      textShadow: '0 0 12px rgba(255,235,59,0.6)',
                    },
                    '& .karaoke-coming': {
                      color: '#FFFFFF',                  // bianco pieno (futuro)
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: karaokeFrame }}
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.6)',
                    fontStyle: 'italic',
                    fontSize: 14,
                  }}
                >
                  {hasKaraoke
                    ? 'Premi ▶ per iniziare — il testo apparirà qui sincronizzato'
                    : 'Nessun testo karaoke trovato in questo file'}
                </Typography>
              )}
            </Paper>
          )}

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 2, mb: 1 }}>
            Motore: midi-audio-player + GeneralUser GS. Riverbero convolutivo + EQ 10 bande + caching IndexedDB.
          </Typography>

          {/* 🔥 Log diagnostico chiuso di default, apribile a richiesta */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>
              🩺 Log diagnostico ({log.length}) — clicca per aprire
            </summary>
            <Box
              component="pre"
              sx={{
                backgroundColor: '#111', color: '#0f0',
                p: 2, borderRadius: 1, fontSize: 11,
                fontFamily: 'monospace', maxHeight: 300,
                overflowY: 'auto', whiteSpace: 'pre-wrap', mt: 1,
              }}
            >
              {log.join('\n') || '(nessun log)'}
            </Box>
          </details>
        </>
      )}
    </Box>
  );
}