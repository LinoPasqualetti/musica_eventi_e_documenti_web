// src/components/renderers/AbcRenderer.jsx
import React, { useEffect, useRef } from 'react';
import abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';

/**
 * Renderer ABC puro, senza UI.
 * - Renderizza il testo ABC nel ref `paperRef`
 * - Collega il player audio nel ref `audioRef` (se supportato)
 * - Se qualcosa crasha, chiama onError(err)
 */
export default function AbcRenderer({
  abcText,
  visualTranspose = 0,
  midiTranspose = 0,
  zoom = 1.0,
  paperRef,
  audioRef,
  synthCtrlRef,
  onSuccess,
  onError,
}) {
  const internalPaperRef = useRef(null);
  const internalAudioRef = useRef(null);
  const paperEl = paperRef || internalPaperRef;
  const audioEl = audioRef || internalAudioRef;

  useEffect(() => {
    if (!abcText) return;
    if (!paperEl.current) return;

    try {
      // Ferma eventuale audio precedente
      if (synthCtrlRef?.current) {
        try { synthCtrlRef.current.pause(); } catch (_) {}
        synthCtrlRef.current = null;
      }

      // Reset container
      paperEl.current.innerHTML = '';

      const renderOptions = {
        responsive: 'resize',
        staffwidth: 800,
        scale: 1.3 * zoom,
        add_classes: true,
        visualTranspose,
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

      // 🎯 IL PUNTO CRITICO: se questo crasha, il catch chiama onError
      const visualObjs = abcjs.renderAbc(paperEl.current, abcText, renderOptions);

      // Audio
      let audioOk = false;
      if (abcjs.synth?.supportsAudio?.() && visualObjs.length > 0 && audioEl?.current) {
        audioEl.current.innerHTML = '';
        const ctrl = new abcjs.synth.SynthController();
        ctrl.load(audioEl.current, null, {
          displayRestart: true,
          displayPlay: true,
          displayProgress: true,
          displayWarp: true,
        });
        ctrl.setTune(visualObjs[0], false, {
          program: 0,
          midiTranspose,
        });
        if (synthCtrlRef) synthCtrlRef.current = ctrl;
        audioOk = true;
      }

      if (onSuccess) onSuccess({ visualObjs, hasAudio: audioOk });
    } catch (e) {
      console.error('[AbcRenderer] crash:', e);
      if (onError) onError(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abcText, visualTranspose, midiTranspose, zoom]);

  return null; // Il renderer non produce UI, usa il ref passato
}