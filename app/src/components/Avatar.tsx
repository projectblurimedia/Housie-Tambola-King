import React from 'react';
import { Text, View } from 'react-native';

/** 50 built-in avatars (no uploads → no moderation needed). Keys a1…a50 match the server check; a1–a12 never change. */
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
  a13: { emoji: '🐶', bg: '#FEF3C7' },
  a14: { emoji: '🐱', bg: '#FFE4E6' },
  a15: { emoji: '🐻', bg: '#E7D5C0' },
  a16: { emoji: '🐮', bg: '#F1F5F9' },
  a17: { emoji: '🐷', bg: '#FBCFE8' },
  a18: { emoji: '🐔', bg: '#FEF9C3' },
  a19: { emoji: '🦉', bg: '#DDD6FE' },
  a20: { emoji: '🦋', bg: '#BFDBFE' },
  a21: { emoji: '🐢', bg: '#D9F99D' },
  a22: { emoji: '🐬', bg: '#A5F3FC' },
  a23: { emoji: '🦈', bg: '#CBD5E1' },
  a24: { emoji: '🐳', bg: '#BAE6FD' },
  a25: { emoji: '🦓', bg: '#E5E7EB' },
  a26: { emoji: '🦒', bg: '#FDE68A' },
  a27: { emoji: '🦘', bg: '#FED7AA' },
  a28: { emoji: '🦩', bg: '#FBCFE8' },
  a29: { emoji: '🦜', bg: '#BBF7D0' },
  a30: { emoji: '🦚', bg: '#99F6E4' },
  a31: { emoji: '🐝', bg: '#FEF08A' },
  a32: { emoji: '🐞', bg: '#FECACA' },
  a33: { emoji: '🦖', bg: '#BBF7D0' },
  a34: { emoji: '🐲', bg: '#A7F3D0' },
  a35: { emoji: '🦅', bg: '#E7E5E4' },
  a36: { emoji: '🐿️', bg: '#FED7AA' },
  a37: { emoji: '🦔', bg: '#E7D5C0' },
  a38: { emoji: '🦦', bg: '#D6D3D1' },
  a39: { emoji: '🐹', bg: '#FFEDD5' },
  a40: { emoji: '🐭', bg: '#F3F4F6' },
  a41: { emoji: '👑', bg: '#FDE68A' },
  a42: { emoji: '🎩', bg: '#E5E7EB' },
  a43: { emoji: '🌟', bg: '#FEF9C3' },
  a44: { emoji: '🍀', bg: '#BBF7D0' },
  a45: { emoji: '🎯', bg: '#FECACA' },
  a46: { emoji: '🎲', bg: '#E0E7FF' },
  a47: { emoji: '🎉', bg: '#FBCFE8' },
  a48: { emoji: '🚀', bg: '#BFDBFE' },
  a49: { emoji: '⚡', bg: '#FEF08A' },
  a50: { emoji: '🔥', bg: '#FED7AA' },
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
