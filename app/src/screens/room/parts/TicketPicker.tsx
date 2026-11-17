import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatRupees } from '@/components/Money';
import { Button, T } from '@/components/ui';
import { fonts, goldGradient, radius, spacing, useThemeColors } from '@/theme';

/**
 * "How many tickets this game?" — asked at the start of every game. The choice is
 * confirmed and then final for that game (the server refuses changes), so nobody can keep
 * re-picking until they like their ticket numbers.
 */
export function TicketPicker({
  visible,
  price,
  gameLabel,
  busy,
  onPick,
  onClose,
}: {
  visible: boolean;
  price: number;
  gameLabel: string;
  busy?: boolean;
  onPick: (count: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const slide = useRef(new Animated.Value(0)).current;
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setChosen(null);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, friction: 7, useNativeDriver: true }).start();
    }
  }, [visible, slide]);

  return (
    <>
      <Modal transparent visible={visible && chosen === null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
            ]}
          >
            <Pressable>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <T variant="smallBold" center color={colors.primary}>
                {gameLabel}
              </T>
              <T variant="h1" center style={{ marginTop: 4 }}>
                {t('lobby.howManyTickets')}
              </T>
              <T variant="small" muted center>
                {t('lobby.ticketsHelp')}
              </T>
              <View style={styles.grid}>
                {[1, 2, 3, 4].map((n) => (
                  <Pressable key={n} onPress={() => setChosen(n)} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.94 }] }]}>
                    <LinearGradient colors={goldGradient} style={[styles.option, { borderColor: colors.goldDark }]}>
                      <T variant="tiny">{'🎫'.repeat(n)}</T>
                      <T style={styles.count} color="#3B1D00">
                        {n}
                      </T>
                      <T variant="tiny" color="#3B1D00">
                        {formatRupees(n * price)}
                      </T>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
              <Button title={t('lobby.later')} variant="ghost" onPress={onClose} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      <ConfirmModal
        visible={visible && chosen !== null}
        icon="ticket"
        gradient={BRAND_GRADIENT}
        title={t('lobby.confirmTicketsTitle', { count: chosen ?? 0 })}
        message={t('lobby.confirmTicketsMessage', { count: chosen ?? 0, amount: formatRupees((chosen ?? 0) * price) })}
        confirmLabel={t('lobby.confirmTickets')}
        loading={busy}
        onCancel={() => setChosen(null)}
        onConfirm={() => chosen && onPick(chosen)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.md },
  grid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xl },
  option: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 2 },
  count: { fontFamily: fonts.display, fontSize: 36, lineHeight: 48 },
});
