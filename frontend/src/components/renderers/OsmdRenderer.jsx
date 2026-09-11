// src/components/renderers/OsmdRenderer.jsx
import React, { useEffect, useRef } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

/**
 * Renderer OSMD puro, senza UI.
 * - Riceve direttamente il testo MusicXML (già estratto dall'MXL)
 * - Applica la trasposizione visiva
 * - Chiama onError(err) se qualcosa crasha
 */
export default function OsmdRenderer({
  xmlText,
  visualTranspose = 0,
  containerRef,
  onSuccess,
  onError,
}) {
  const internalRef = useRef(null);
  const ref = containerRef || internalRef;
  const osmdRef = useRef(null);

  // Init OSMD (una volta sola, quando il container è pronto)
  useEffect(() => {
    if (!containerRef && !internalRef.current) return;
    if (osmdRef.current) return;
    if (!ref.current) return;

    try {
      ref.current.innerHTML = '';
      osmdRef.current = new OpenSheetMusicDisplay(ref.current, {
        autoResize: true,
        backend: 'svg',
        drawTitle: true,
        drawComposer: true,
        drawLyricist: true,
        drawCredits: true,
        drawPartNames: true,
      });
    } catch (e) {
      console.error('[OsmdRenderer] init crash:', e);
      if (onError) onError(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render quando cambia xmlText o trasposizione
  useEffect(() => {
    if (!xmlText || !osmdRef.current) return;

    const render = async () => {
      try {
        await osmdRef.current.load(xmlText);

        // Trasposizione visiva
        try {
          osmdRef.current.Sheet.Transpose = visualTranspose;
        } catch (e) {
          console.warn('[OsmdRenderer] transpose not supported:', e);
        }

        osmdRef.current.render();
        if (onSuccess) onSuccess({});
      } catch (e) {
        console.error('[OsmdRenderer] render crash:', e);
        if (onError) onError(e);
      }
    };

    const raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlText, visualTranspose]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (osmdRef.current) {
        try { osmdRef.current.clear(); } catch (_) {}
        osmdRef.current = null;
      }
    };
  }, []);

  return null; // Solo ref
}