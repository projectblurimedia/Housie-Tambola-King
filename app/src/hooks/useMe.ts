import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * The signed-in player's profile. The last loaded copy is kept on the phone and shown at once,
 * so the name never goes blank ("Namaste, !") while the network lags or the app is starting;
 * without any copy it keeps retrying every few seconds until it loads.
 */
export function useMe() {
  const session = useSessionStore((s) => s.session);
  const lastMe = useSettingsStore((s) => s.lastMe);
  const setLastMe = useSettingsStore((s) => s.setLastMe);
  const uid = session?.user.id;
  const cached = lastMe && lastMe.id === uid ? lastMe : undefined;
  const query = useQuery({
    queryKey: ['me'],
    queryFn: profileService.getMe,
    enabled: !!session,
    staleTime: 15_000,
    placeholderData: cached,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchInterval: (q) => (q.state.data ? false : 5000),
  });
  useEffect(() => {
    if (query.data && !query.isPlaceholderData) setLastMe(query.data);
  }, [query.data, query.isPlaceholderData, setLastMe]);
  return query;
}

export function useAppSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: profileService.getSettings, staleTime: 5 * 60_000 });
}
