import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatCoins } from '@/components/Money';
import { Card, Row, T } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { radius, spacing, useThemeColors } from '@/theme';

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  welcome: 'gift',
  ticket: 'ticket',
  refund: 'return-up-back',
  prize: 'trophy',
  admin: 'shield-checkmark',
};

/** Play coins: the balance and (tap) the history — welcome, tickets, refunds, prizes. */
export function CoinsCard({ coins }: { coins: number }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [open, setOpen] = useState(false);
  const ledger = useQuery({ queryKey: ['coinLedger'], queryFn: roomService.coinLedger, enabled: open });
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <LinearGradient colors={['#1E0B3B', '#3B0764']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
          <LinearGradient colors={['#FFF1A8', '#F5B700', '#B87400']} style={styles.coin}>
            <T style={{ fontSize: 22, lineHeight: 28 }}>🪙</T>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <T variant="tiny" color="#FDE68A" style={{ letterSpacing: 1.5 }}>
              {t('coins.title').toUpperCase()}
            </T>
            <T variant="h1" color="#fff">
              {formatCoins(coins).replace('🪙 ', '')}
            </T>
            <T variant="tiny" color="rgba(255,255,255,0.7)">
              {t('coins.playOnly')}
            </T>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#FDE68A" />
        </LinearGradient>
      </Pressable>
      {open ? (
        <View style={{ padding: spacing.md, gap: 6 }}>
          {ledger.isLoading ? (
            <T variant="small" muted>
              {t('common.loading')}
            </T>
          ) : (ledger.data ?? []).length === 0 ? (
            <T variant="small" muted>
              {t('coins.noHistory')}
            </T>
          ) : (
            (ledger.data ?? []).map((l) => (
              <Row key={l.id} gap={spacing.sm}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={ICON[l.reason] ?? 'ellipse'} size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="small">{t(`coins.reason_${l.reason}`)}</T>
                  <T variant="tiny" muted numberOfLines={1}>
                    {[l.roomTitle, new Date(l.at).toLocaleDateString()].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <T variant="smallBold" color={Number(l.delta) >= 0 ? colors.success : colors.error}>
                  {Number(l.delta) >= 0 ? '+' : '−'}
                  {Math.abs(Number(l.delta)).toLocaleString('en-IN')}
                </T>
              </Row>
            ))
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  coin: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
