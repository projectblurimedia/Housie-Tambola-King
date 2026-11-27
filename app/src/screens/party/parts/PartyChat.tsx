import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, FlatList, KeyboardAvoidingView, PanResponder, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { IconButton, Row, T } from '@/components/ui';
import { partyChatKey } from '@/hooks/useParty';
import { TypingDots } from '@/screens/room/parts/RoomChat';
import { partyService, type PartyChatMessage } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { TYPING_MS, usePartyTyping } from '@/state/partyTypingStore';
import { showToast } from '@/state/toastStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/**
 * Party game chat, the same as the Housie room chat: a floating button (in the game's
 * gradient, with an unread count) opens a panel inside the screen — the game above stays
 * usable. Gradient header = drag handle (up = full screen, down = half / close; tap to
 * switch), "X is typing…" with bouncing dots, newest message at the bottom, mine on the right.
 */
export function PartyChat({ partyId, meId, colors: gradient, players }: { partyId: string; meId: string; colors: [string, string]; players: number }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const qc = useQueryClient();
  const chat = useQuery({ queryKey: partyChatKey(partyId), queryFn: () => partyService.chat(partyId), staleTime: 30_000 });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const [full, setFull] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const HALF = Math.round(screenH * 0.52);
  const FULL = Math.round(screenH * 0.9);
  const sheetH = useRef(new Animated.Value(HALF)).current;
  const startH = useRef(HALF);
  const lastTyping = useRef(0);

  const messages = chat.data ?? [];
  const newest = messages.length ? messages[messages.length - 1].id : 0;
  const unread = useMemo(() => messages.filter((m) => m.id > seenId && m.userId !== meId).length, [messages, seenId, meId]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  // Who's typing (stale after a few seconds).
  const typingMap = usePartyTyping((s) => s.typing[partyId]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);
  const othersTyping = Object.values(typingMap ?? {}).filter((p) => p.userId !== meId && now - p.at < TYPING_MS);

  useEffect(() => {
    if (open) setSeenId(newest);
  }, [open, newest]);

  const snap = (toFull: boolean) => {
    setFull(toFull);
    Animated.spring(sheetH, { toValue: toFull ? FULL : HALF, friction: 9, tension: 70, useNativeDriver: false }).start();
  };
  const show = () => {
    setMounted(true);
    setOpen(true);
    setFull(false);
    sheetH.setValue(HALF);
    Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  };
  const close = () => {
    setOpen(false);
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => setMounted(false));
  };
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        sheetH.stopAnimation((v) => (startH.current = v));
      },
      onPanResponderMove: (_e, g) => sheetH.setValue(Math.max(screenH * 0.25, Math.min(FULL, startH.current - g.dy))),
      onPanResponderRelease: (_e, g) => {
        const h = startH.current - g.dy;
        if (startH.current < (HALF + FULL) / 2 && (g.dy > 110 || g.vy > 1.2)) {
          close();
          return;
        }
        snap(g.vy < -0.6 || h > (HALF + FULL) / 2);
      },
    }),
  ).current;

  const onType = (v: string) => {
    setText(v.slice(0, 200));
    if (v && Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      partyService.chatTyping(partyId).catch(() => undefined);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await partyService.sendChat(partyId, body);
      qc.setQueryData<PartyChatMessage[]>(partyChatKey(partyId), (old) => (old?.some((m) => m.id === msg.id) ? old : [...(old ?? []), msg]));
      setText('');
      lastTyping.current = 0;
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open ? null : (
        <Pressable onPress={show} style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} accessibilityLabel={t('chat.title')}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
            <Ionicons name="chatbubbles" size={24} color="#fff" />
          </LinearGradient>
          {unread ? (
            <View style={styles.badge}>
              <T style={styles.badgeText} maxFontSizeMultiplier={FIXED_SHAPE_SCALE}>
                {unread > 9 ? '9+' : unread}
              </T>
            </View>
          ) : null}
        </Pressable>
      )}

      {mounted ? (
        <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ flex: 1 }} pointerEvents="none" />
          <Animated.View style={[styles.sheet, { height: sheetH, opacity: fade, backgroundColor: colors.surface }]}>
            <View {...drag.panHandlers}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Pressable onPress={() => snap(!full)} style={styles.handleArea} accessibilityLabel={t('chat.expand')}>
                  <View style={styles.handle} />
                </Pressable>
                <View style={styles.head}>
                  <Ionicons name="chatbubbles" size={20} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <T variant="h3" color="#fff">
                      {t('chat.title')}
                    </T>
                    <T variant="tiny" color="rgba(255,255,255,0.8)">
                      {t('chat.members', { count: players })}
                    </T>
                  </View>
                  <IconButton icon={full ? 'contract' : 'expand'} color="#fff" onPress={() => snap(!full)} />
                  <IconButton icon="close" color="#fff" onPress={close} />
                </View>
              </LinearGradient>
            </View>

            <FlatList
              data={reversed}
              inverted
              keyExtractor={(m) => String(m.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: 8, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <T muted center>
                    {t('chat.empty')}
                  </T>
                </View>
              }
              renderItem={({ item }) => {
                const mine = item.userId === meId;
                return (
                  <Row gap={6} style={{ justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                    {mine ? null : <Avatar avatarKey={item.avatarKey} size={28} />}
                    <View style={[styles.bubble, mine ? { backgroundColor: gradient[1] } : { backgroundColor: colors.surfaceAlt }]}>
                      {mine ? null : (
                        <T variant="tiny" color={colors.primary} style={{ fontFamily: fonts.semibold }}>
                          {item.name}
                        </T>
                      )}
                      <T variant="small" color={mine ? '#fff' : colors.text}>
                        {item.body}
                      </T>
                      <T variant="tiny" color={mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} style={{ alignSelf: 'flex-end' }}>
                        {new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </T>
                    </View>
                  </Row>
                );
              }}
            />

            {othersTyping.length ? (
              <Row gap={6} style={styles.typingRow}>
                {othersTyping.slice(0, 3).map((x) => (
                  <Avatar key={x.userId} avatarKey={x.avatarKey} size={20} />
                ))}
                <T variant="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                  {othersTyping.length === 1 ? t('chat.typingOne', { name: othersTyping[0].name.split(' ')[0] }) : t('chat.typingMany', { count: othersTyping.length })}
                </T>
                <TypingDots color={colors.primary} />
              </Row>
            ) : null}

            <Row gap={8} style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: spacing.sm + insets.bottom }]}>
              <TextInput
                value={text}
                onChangeText={onType}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={send}
                returnKeyType="send"
                style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
              />
              <Pressable onPress={send} disabled={!text.trim() || sending} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.send, { opacity: text.trim() ? 1 : 0.5 }]}>
                  <Ionicons name="send" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            </Row>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', left: spacing.lg, zIndex: 20 },
  fabInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', elevation: 6 },
  badge: { position: 'absolute', right: -2, top: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden', elevation: 12 },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingBottom: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, gap: 1 },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: 6 },
  inputRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
