import React from 'react';
import { Text, TextStyle } from 'react-native';
import { fonts } from '@/theme';

/** Casual play amount: "₹25", "₹12.50". Not real money. */
export function formatRupees(n: number | string): string {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function Money({ amount, size = 15, color = '#B45309', style }: { amount: number; size?: number; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fonts.bold, fontSize: size, color }, style]}>{formatRupees(amount)}</Text>;
}
