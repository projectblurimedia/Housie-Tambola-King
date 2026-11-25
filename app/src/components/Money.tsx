import React from 'react';
import { Text, TextStyle } from 'react-native';
import { fonts } from '@/theme';

import { useStakeStore } from '@/state/stakeStore';
import { CoinAmount } from '@/components/CoinIcon';
import i18n from '@/localization/i18n';

const num = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });

/**
 * An amount in the current room's stake: "25 coins" in a coins room, "₹25" otherwise (casual
 * play amounts — never real money). Free rooms hide amounts on screen (see isFreeRoom).
 */
export function formatRupees(n: number | string): string {
  const v = Number(n) || 0;
  return useStakeStore.getState().mode === 'coins' ? formatCoins(v) : `₹${num(v)}`;
}

/** Coins in a sentence, e.g. "1,000 coins" (on-screen amounts use CoinAmount: crown coin + number). */
export function formatCoins(n: number | string): string {
  return i18n.t('coins.amount', { n: num(Number(n) || 0) });
}

export function Money({ amount, size = 15, color = '#B45309', style }: { amount: number; size?: number; color?: string; style?: TextStyle }) {
  const mode = useStakeStore((s) => s.mode);
  if (mode === 'coins') return <CoinAmount value={amount} color={color} size={size + 1} gap={4} />;
  return <Text style={[{ fontFamily: fonts.bold, fontSize: size, color }, style]}>{formatRupees(amount)}</Text>;
}
