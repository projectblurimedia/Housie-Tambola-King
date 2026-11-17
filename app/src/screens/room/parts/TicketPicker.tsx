import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatRupees } from '@/components/Money';
import { Button, T } from '@/components/ui';
import { fonts, goldGradient, radius, spacing, useThemeColors } from '@/theme';

/** "How many tickets this game?" — asked at the start of every game in the room. */
export function TicketPicker({
  visible,
  current,
  price,
  gameLabel,
  busy,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: number;
  price: number;
  gameLabel: string;
  busy?: boolean;
  onPick: (count: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, friction: 7, useNativeDriver: true }).start();
    }
  }, [visible, slide]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
              {[1, 2, 3, 4].map((n) => {
                const active = n === current;
                return (
                  <Pressable key={n} onPress={() => onPick(n)} disabled={busy} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.94 }] }]}>
                    <LinearGradient
                      colors={active ? goldGradient : [colors.surfaceAlt, colors.surfaceAlt]}
                      style={[styles.option, { borderColor: active ? colors.goldDark : colors.border }]}
                    >
                      <T variant="tiny">{'🎫'.repeat(n)}</T>
                      <T style={styles.count} color={active ? '#3B1D00' : colors.text}>
                        {n}
                      </T>
                      <T variant="tiny" color={active ? '#3B1D00' : colors.textMuted}>
                        {formatRupees(n * price)}
                      </T>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
            {current > 0 ? <Button title={t('common.close')} variant="ghost" onPress={onClose} /> : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.md },
  grid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xl },
  option: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 2 },
  count: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46 },
});
