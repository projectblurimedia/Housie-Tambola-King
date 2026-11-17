import React from 'react';
import { Text, View } from 'react-native';

/** 12 built-in avatars (no uploads → no moderation needed). Keys a1…a12 match the DB check. */
export const AVATARS: Record<string, { emoji: string; bg: string }> = {
  a1: { emoji: '🦁', bg: '#FDE68A' },
  a2: { emoji: '🐯', bg: '#FDBA74' },
  a3: { emoji: '🐼', bg: '#E5E7EB' },
  a4: { emoji: '🦊', bg: '#FCA5A5' },
  a5: { emoji: '🐸', bg: '#BBF7D0' },
  a6: { emoji: '🐵', bg: '#D6D3D1' },
  a7: { emoji: '🦄', bg: '#F5D0FE' },
  a8: { emoji: '🐙', bg: '#FBCFE8' },
  a9: { emoji: '🐧', bg: '#BAE6FD' },
  a10: { emoji: '🐨', bg: '#CBD5E1' },
  a11: { emoji: '🐰', bg: '#FECDD3' },
  a12: { emoji: '🐘', bg: '#C7D2FE' },
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export function Avatar({ avatarKey, size = 40, ring }: { avatarKey: string; size?: number; ring?: string }) {
  const a = AVATARS[avatarKey] ?? AVATARS.a1;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: a.bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 3 : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>{a.emoji}</Text>
    </View>
  );
}
