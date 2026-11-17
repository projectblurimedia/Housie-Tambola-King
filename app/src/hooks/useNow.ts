import { useEffect, useState } from 'react';
import i18n from '@/localization/i18n';

/** Re-renders every `intervalMs` with the current time (countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "2m 05s" / "45s" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0
    ? i18n.t('common.minutesSeconds', { m, s: String(s).padStart(2, '0') })
    : i18n.t('common.seconds', { count: s });
}
