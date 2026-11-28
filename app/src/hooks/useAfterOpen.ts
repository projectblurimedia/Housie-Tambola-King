import { useEffect, useState } from 'react';

/**
 * False on the first frames, true once the screen has opened (two frames + a short pause for the
 * slide-in). Heavy drawings (board previews, the full game board) wait for it, so a screen opens
 * instantly with a light placeholder instead of freezing on the tap.
 */
export function useAfterOpen(delayMs = 180): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let r1 = 0;
    let r2 = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        timer = setTimeout(() => setReady(true), delayMs);
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      if (timer) clearTimeout(timer);
    };
  }, [delayMs]);
  return ready;
}
