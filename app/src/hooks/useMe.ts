import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useSessionStore } from '@/state/sessionStore';

export function useMe() {
  const session = useSessionStore((s) => s.session);
  return useQuery({
    queryKey: ['me'],
    queryFn: profileService.getMe,
    enabled: !!session,
    staleTime: 15_000,
  });
}

export function useAppSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: profileService.getSettings, staleTime: 5 * 60_000 });
}
