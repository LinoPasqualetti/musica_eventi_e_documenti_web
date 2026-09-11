// src/components/MidiPlayer.jsx — QUALITÀ MIGLIORATA
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, IconButton, Slider, Stack, CircularProgress,
  Alert, Chip, Tooltip, Divider
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';

// ---- Soundfont MusyngKite (qualità migliore di FluidR3) ----
const SOUNDFONT_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite';

export default function MidiPlayer({ contentUrl, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [tracks, setTracks] = useState([]);
  const [volume, setVolume] = useState(-6);
  const [log, setLog] = useState([]);

  const midiRef = useRef(null);
  const synthsRef = useRef([]);
  const partRef = useRef(null);
  const rafRef = useRef(null);
  const offsetRef = useRef(0);
  const reverbRef = useRef(null);
  const compressorRef = useRef(null);

  const append = (msg) => {
    console.log('[MidiPlayer]', msg);
    const ts = new Date().toLocaleTimeString();
    const important = /pronti|caricati|Playback|ERRORE|TIMEOUT|FALLITO|fallback|Reverb|Compressore/i.test(msg);
    setLog((l) => [...l, `${important ? '⭐' : '  '} [${ts}] ${msg}`]);
  };

  // ---- 1. Carica e parsa il MIDI ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    append(`Carico ${contentUrl}`);

    fetch(contentUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const midi = new Midi(buffer);
        midiRef.current = midi;
        setDuration(midi.duration);
        const trks = midi.tracks.map((t, i) => ({
          index: i,
          name: t.name || `Traccia ${i + 1}`,
          instrument: t.instrument?.name || 'acoustic_grand_piano',
          noteCount: t.notes.length,
          muted: false,
        }));
        setTracks(trks);
        append(`MIDI parsato: ${midi.tracks.length} tracce, ${midi.duration.toFixed(1)}s`);
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

  // ---- 2. Crea reverb + compressore (una volta sola) ----
  const ensureEffects = async () => {
    if (reverbRef.current && compressorRef.current) return;

    append('Creo reverb (2.5s, wet 25%)…');
    reverbRef.current = new Tone.Reverb({ decay: 2.5, wet: 0.25 });
    await reverbRef.current.generate();
    append('Reverb pronto');

    append('Creo compressore (threshold -12, ratio 3)…');
    compressorRef.current = new Tone.Compressor(-12, 3).toDestination();
    append('Compressore pronto');

    // Catena: reverb → compressore → output
    reverbRef.current.connect(compressorRef.current);
  };

  // ---- 3. Crea i synth (deduplicati) ----
  const buildSynths = async () => {
    const midi = midiRef.current;
    if (!midi) return [];

    await ensureEffects();

    // Raccogli gli strumenti UNICI (sanificati per il CDN)
    const instrumentMap = new Map();
    const uniqueInstruments = new Set();
    midi.tracks.forEach((track) => {
      let instName = (track.instrument?.name || 'acoustic_grand_piano').replace(/\s+/g, '_');
      instName = instName.replace(/[()]/g, '');
      uniqueInstruments.add(instName);
    });

    append(`Strumenti unici da caricare: ${uniqueInstruments.size} (${[...uniqueInstruments].join(', ')})`);

    // Fallback per strumenti problematici sul CDN
    const FALLBACKS = {
      'standard_kit': 'acoustic_grand_piano',
      'electric_guitar_jazz': 'electric_guitar_clean',
      'synthbrass_2': 'brass_section',
    };

    const loadPromises = [...uniqueInstruments].map((instName) => {
      return new Promise((resolve) => {
        const realName = FALLBACKS[instName] || instName;
        append(`Carico soundfont: ${realName}${realName !== instName ? ` (fallback per ${instName})` : ''}`);

        let done = false;
        const finish = (synth) => {
          if (done) return;
          done = true;
          instrumentMap.set(instName, synth);
          resolve();
        };

        try {
          const synth = new Tone.Sampler({
            urls: { C4: `${SOUNDFONT_BASE}/${realName}-mp3/C4.mp3` },
            baseUrl: '',
            release: 1,
            onload: () => {
              append(`Soundfont pronto: ${realName}`);
              finish(synth);
            },
            onerror: () => {
              append(`⚠️ Soundfont FALLITO: ${realName}`);
              finish(null);
            },
          }).connect(reverbRef.current); // ← passa dal reverb
          synth.volume.value = volume;

          setTimeout(() => {
            if (!done) {
              append(`⚠️ TIMEOUT soundfont: ${realName} (15s)`);
              finish(synth);
            }
          }, 15000);
        } catch (e) {
          append(`⚠️ ERRORE sampler ${realName}: ${e.message}`);
          finish(null);
        }
      });
    });

    await Promise.all(loadPromises);

    const loaded = [...instrumentMap.values()].filter((s) => s !== null).length;
    append(`Tutti i soundfont caricati (${loaded}/${uniqueInstruments.size} con successo)`);

    const synths = midi.tracks.map((track) => {
      let instName = (track.instrument?.name || 'acoustic_grand_piano').replace(/\s+/g, '_');
      instName = instName.replace(/[()]/g, '');
      return instrumentMap.get(instName) || null;
    });

    return synths;
  };

  // ---- 4. Play ----
  const handlePlay = async () => {
    if (!midiRef.current || playing) return;
    try {
      append('Play richiesto');
      await Tone.start();
      append(`Tone context state: ${Tone.getContext().state}`);
      const midi = midiRef.current;

      if (synthsRef.current.length === 0) {
        append('Carico soundfont in corso… (attendi)');
        synthsRef.current = await buildSynths();
      }
      const synths = synthsRef.current;

      const events = [];
      midi.tracks.forEach((track, ti) => {
        if (tracks[ti]?.muted) return;
        track.notes.forEach((n) => {
          events.push({
            time: n.time,
            note: n.name,
            duration: n.duration,
            velocity: n.velocity,
            trackIndex: ti,
          });
        });
      });
      events.sort((a, b) => a.time - b.time);
      append(`Programmo ${events.length} note`);

      const part = new Tone.Part((time, ev) => {
        const s = synths[ev.trackIndex];
        if (s) s.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity);
      }, events.map((e) => [e.time, e]));
      part.start(0);
      partRef.current = part;

      const transport = Tone.getTransport();
      transport.stop();
      transport.seconds = offsetRef.current;
      transport.start();
      setPlaying(true);
      append('Playback avviato');

      const tick = () => {
        const t = transport.seconds;
        setCurrentTime(t);
        if (t >= midi.duration) { handleStop(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      append(`ERRORE play: ${e.message}`);
      setError(e.message);
    }
  };

  // ---- 5. Pause ----
  const handlePause = () => {
    const transport = Tone.getTransport();
    offsetRef.current = transport.seconds;
    transport.pause();
    synthsRef.current.forEach((s) => { try { s.releaseAll(); } catch (_) {} });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    append('Pausa');
  };

  // ---- 6. Stop ----
  const handleStop = () => {
    const transport = Tone.getTransport();
    transport.stop();
    if (partRef.current) {
      partRef.current.stop();
      partRef.current.dispose();
      partRef.current = null;
    }
    synthsRef.current.forEach((s) => { try { s.releaseAll(); } catch (_) {} });
    offsetRef.current = 0;
    setCurrentTime(0);
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    append('Stop');
  };

  // ---- 7. Seek ----
  const handleSeek = (_, value) => {
    const t = typeof value === 'number' ? value : 0;
    offsetRef.current = t;
    setCurrentTime(t);
    if (playing) {
      handleStop();
      setTimeout(() => handlePlay(), 50);
    }
  };

  // ---- 8. Volume ----
  const handleVolume = (_, value) => {
    setVolume(value);
    synthsRef.current.forEach((s) => {
      try { s.volume.value = value; } catch (_) {}
    });
  };

  // ---- 9. Mute traccia ----
  const toggleMute = (index) => {
    setTracks((prev) => {
      const next = prev.map((t) =>
        t.index === index ? { ...t, muted: !t.muted } : t
      );
      const s = synthsRef.current[index];
      if (s) s.mute = next.find((t) => t.index === index)?.muted ?? false;
      return next;
    });
  };

  // ---- 10. Formato tempo ----
  const fmt = (sec) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (partRef.current) { try { partRef.current.dispose(); } catch (_) {} }
      synthsRef.current.forEach((s) => { try { s.dispose(); } catch (_) {} });
      if (reverbRef.current) { try { reverbRef.current.dispose(); } catch (_) {} }
      if (compressorRef.current) { try { compressorRef.current.dispose(); } catch (_) {} }
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <IconButton
              onClick={playing ? handlePause : handlePlay}
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

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 140 }}>
              <VolumeUpIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
              <Slider
                value={volume}
                min={-40}
                max={6}
                step={1}
                onChange={handleVolume}
                sx={{ color: '#9575cd', width: 90 }}
              />
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', my: 2 }} />

          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
            Tracce ({tracks.length})
          </Typography>
          <Box
            sx={{
              maxHeight: 200, overflowY: 'auto',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 1, p: 1, mb: 2,
            }}
          >
            {tracks.map((t) => (
              <Box
                key={t.index}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  py: 0.5, px: 1, opacity: t.muted ? 0.4 : 1,
                }}
              >
                <Chip
                  label={t.index + 1}
                  size="small"
                  sx={{ backgroundColor: 'rgba(149,117,205,0.4)', color: 'white', height: 20, minWidth: 24 }}
                />
                <Typography sx={{ color: 'white', fontSize: 13, flex: 1 }} noWrap>
                  {t.name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                  {t.instrument} · {t.noteCount} note
                </Typography>
                <Tooltip title={t.muted ? 'Attiva' : 'Silenzia'}>
                  <IconButton
                    size="small"
                    onClick={() => toggleMute(t.index)}
                    sx={{ color: t.muted ? '#ef5350' : 'rgba(255,255,255,0.7)' }}
                  >
                    {t.muted ? '🔇' : '🔊'}
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 1 }}>
            Soundfont: MusyngKite + Reverb 2.5s + Compressore. Il primo play carica i campioni (qualche secondo), i successivi sono istantanei.
          </Typography>

          <details style={{ marginTop: 16 }} open>
            <summary style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>
              Log diagnostico ({log.length})
            </summary>
            <Box
              component="pre"
              sx={{
                backgroundColor: '#111', color: '#0f0',
                p: 2, borderRadius: 1, fontSize: 11,
                fontFamily: 'monospace', maxHeight: 400,
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