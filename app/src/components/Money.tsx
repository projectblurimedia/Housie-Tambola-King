import React from 'react';
import { Text, TextStyle } from 'react-native';
import { fonts } from '@/theme';

import { useStakeStore } from '@/state/stakeStore';

const num = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });

/**
 * An amount in the current room's stake: "🪙 25" in a coins room, "₹25" otherwise (casual
 * play amounts — never real money). Free rooms hide amounts on screen (see isFreeRoom).
 */
export function formatRupees(n: number | string): string {
  const v = Number(n) || 0;
  return useStakeStore.getState().mode === 'coins' ? `🪙 ${num(v)}` : `₹${num(v)}`;
}

/** Plain coins, e.g. a balance: "🪙 1,000". */
export function formatCoins(n: number | string): string {
  return `🪙 ${num(Number(n) || 0)}`;
}

export function Money({ amount, size = 15, color = '#B45309', style }: { amount: number; size?: number; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fonts.bold, fontSize: size, color }, style]}>{formatRupees(amount)}</Text>;
}
