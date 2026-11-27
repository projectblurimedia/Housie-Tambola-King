import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { IconButton, Row, T } from '@/components/ui';
import { appendChat, chatKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { useChatStore } from '@/state/chatStore';
import { TYPING_MS, useChatLiveStore } from '@/state/chatLiveStore';
import { showToast } from '@/state/toastStore';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ChatMessage, RoomState } from '@/types/api';

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The room's chat messages (only from when this player joined — the server filters). */
function useChat(roomId: string) {
  return useQuery({ queryKey: chatKey(roomId), queryFn: () => roomService.getChat(roomId), staleTime: 30_000 });
}

/** Unread messages from others (not muted) — for the chat button's badge. */
export function useChatUnread(roomId: string, meId: string): number {
  const chat = useChat(roomId);
  const muted = useChatStore((s) => s.muted);
  const lastSeen = useChatStore((s) => s.lastSeen[roomId] ?? 0);
  return (chat.data ?? []).filter((m) => (m.kind ?? 'user') === 'user' && !m.deleted && !muted[m.userId] && m.id > lastSeen && m.userId !== meId)
    .length;
}

/** Three dots bouncing one after another ("typing…"). */
export function TypingDots({ color }: { color: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(d, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <Row gap={3}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: color, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
        />
      ))}
    </Row>
  );
}

/**
 * Room chat: a panel inside the screen (not a pop-up), half the phone by default — the game
 * above stays usable — that fades in. Newest message at the bottom straight away (the list is
 * drawn bottom-up). "X is typing…", ✓ / ✓✓ seen ticks, long-press for info / delete for
 * everyone. Drag the header to resize (follows the finger): up = full screen, down = half /
 * close. With `showFab` it has its own floating button (lobby); in a game it's opened from
 * the game's chat button (`open` / `onClose`). `readOnly` (ended rooms): history only.
 */
export function RoomChat({
  state,
  meId,
  raised = false,
  showFab = true,
  open: openProp,
  onClose,
  readOnly = false,
}: {
  state: RoomState;
  meId: string;
  raised?: boolean;
  showFab?: boolean;
  open?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const roomId = state.room.id;
  const insets = useSafeAreaInsets();
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;
  const close = () => (onClose ? onClose() : setOpenSelf(false));
  const [text, setText] = useState('');
  const muted = useChatStore((s) => s.muted);
  const toggleMute = useChatStore((s) => s.toggleMute);
  const markSeen = useChatStore((s) => s.markSeen);
  const unread = useChatUnread(roomId, meId);
  const typers = useChatLiveStore((s) => s.typing[roomId]) ?? [];
  const reads = useChatLiveStore((s) => s.reads[roomId]) ?? {};
  const [picked, setPicked] = useState<ChatMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Size: half the phone, drag the header for full screen ──
  const { height: screenH } = useWindowDimensions();
  const halfH = Math.round(screenH * 0.55);
  const fullH = Math.round(screenH - insets.top - 8);
  const sheetH = useRef(new Animated.Value(halfH)).current;
  const [full, setFull] = useState(false);
  const fullRef = useRef(false);
  const dragStart = useRef(halfH);
  const snap = (toFull: boolean) => {
    fullRef.current = toFull;
    setFull(toFull);
    Animated.spring(sheetH, { toValue: toFull ? fullH : halfH, friction: 9, tension: 80, useNativeDriver: false }).start();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        sheetH.stopAnimation((v) => (dragStart.current = v));
      },
      // The sheet follows the finger.
      onPanResponderMove: (_e, g) => {
        sheetH.setValue(Math.max(halfH * 0.5, Math.min(fullH, dragStart.current - g.dy)));
      },
      onPanResponderRelease: (_e, g) => {
        const now = dragStart.current - g.dy;
        if (g.vy < -0.6 || now > (halfH + fullH) / 2) snapRef.current(true);
        else if (g.vy > 0.8 && !fullRef.current) closeRef.current();
        else if (now < halfH * 0.75) closeRef.current();
        else snapRef.current(false);
      },
    }),
  ).current;

  // ── Back button, fade in / out ──
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      fullRef.current = false;
      setFull(false);
      sheetH.setValue(halfH);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    } else if (mounted) {
      Animated.timing(fade, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => setMounted(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Messages, reads, typing ──
  const chat = useChat(roomId);
  const visible = useMemo(() => (chat.data ?? []).filter((m) => !muted[m.userId]), [chat.data, muted]);
  // Drawn bottom-up: newest first in the data, so it opens at the latest message.
  const bottomUp = useMemo(() => [...visible].reverse(), [visible]);
  const newest = chat.data?.length ? chat.data[chat.data.length - 1].id : 0;

  const refetchChat = chat.refetch;
  useEffect(() => {
    if (!open) return;
    refetchChat();
    roomService
      .getChatReads(roomId)
      .then((r) => useChatLiveStore.getState().setReads(roomId, r))
      .catch(() => undefined);
  }, [open, refetchChat, roomId]);

  useEffect(() => {
    if (!open || !newest) return;
    markSeen(roomId, newest);
    if (!readOnly) roomService.markChatRead(roomId, newest).catch(() => undefined);
  }, [open, newest, roomId, markSeen, readOnly]);

  // "typing…" expires after a few seconds without a new signal.
  useEffect(() => {
    if (!open || !typers.length) return;
    const id = setInterval(() => useChatLiveStore.getState().pruneTyping(roomId), 1000);
    return () => clearInterval(id);
  }, [open, typers.length, roomId]);
  const othersTyping = typers.filter((x) => x.userId !== meId && Date.now() - x.at < TYPING_MS);

  const lastTypingSent = useRef(0);
  const onType = (v: string) => {
    setText(v.slice(0, 200));
    if (v && Date.now() - lastTypingSent.current > 3000) {
      lastTypingSent.current = Date.now();
      roomService.chatTyping(roomId).catch(() => undefined);
    }
  };

  const send = useMutation({
    mutationFn: (body: string) => roomService.sendChat(roomId, body),
    onSuccess: (msg) => {
      setText('');
      appendChat(qc, roomId, msg);
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  const submit = () => {
    const body = text.trim();
    if (body && !send.isPending) send.mutate(body);
  };

  const remove = useMutation({
    mutationFn: (id: number) => roomService.deleteChatMessage(id),
    onSuccess: (_r, id) => qc.setQueryData<ChatMessage[]>(chatKey(roomId), (old) => old?.map((m) => (m.id === id ? { ...m, deleted: true, body: '' } : m))),
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  const others = state.members.filter((m) => m.userId !== meId);
  /** Who (other than me) has read up to this message. */
  const seenBy = (id: number) => others.filter((m) => (reads[m.userId] ?? 0) >= id);

  return (
    <>
      {showFab ? (
        <Pressable
          onPress={() => setOpenSelf(true)}
          accessibilityLabel={t('chat.title')}
          style={({ pressed }) => [styles.fab, { bottom: (raised ? spacing.xl + 74 : spacing.xl) + insets.bottom, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
            <Ionicons name="chatbubbles" size={26} color="#fff" />
          </LinearGradient>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.pink }]}>
              <T variant="tiny" color="#fff" style={{ fontFamily: fonts.bold }}>
                {unread > 9 ? '9+' : unread}
              </T>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* Not a pop-up window: a panel inside the screen that fades in. Everything above it
          (tickets, numbers) stays usable — chat and strike at the same time. */}
      {mounted ? (
        <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ flex: 1 }} pointerEvents="none" />
          <Animated.View style={[styles.sheet, { height: sheetH, opacity: fade, backgroundColor: colors.surface }]}>
            {/* The whole header is the drag handle (tap the bar to switch half / full). */}
            <View {...drag.panHandlers}>
              <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
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
                      {t('chat.members', { count: state.members.length })}
                    </T>
                  </View>
                  <IconButton icon={full ? 'contract' : 'expand'} color="#fff" onPress={() => snap(!full)} />
                  <IconButton icon="close" color="#fff" onPress={close} />
                </View>
              </LinearGradient>
            </View>

            {others.length && !readOnly ? (
              <View style={[styles.people, { borderBottomColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.md }}>
                  {others.map((m) => {
                    const off = !!muted[m.userId];
                    return (
                      <Pressable key={m.userId} onPress={() => toggleMute(m.userId)} style={styles.person} accessibilityLabel={off ? t('chat.unmute') : t('chat.mute')}>
                        <View style={{ opacity: off ? 0.45 : 1 }}>
                          <Avatar avatarKey={m.avatarKey} size={34} />
                        </View>
                        <View style={[styles.muteDot, { backgroundColor: off ? colors.error : colors.success, borderColor: colors.surface }]}>
                          <Ionicons name={off ? 'volume-mute' : 'volume-high'} size={10} color="#fff" />
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <FlatList
              data={bottomUp}
              inverted
              keyExtractor={(m) => String(m.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
                  <T style={{ fontSize: 34, lineHeight: 44 }}>💬</T>
                  <T muted center>
                    {chat.isLoading ? t('common.loading') : t('chat.empty')}
                  </T>
                </View>
              }
              renderItem={({ item }) => {
                const kind = item.kind ?? 'user';
                if (kind !== 'user') {
                  const who = item.userId === meId ? t('common.you') : item.name;
                  return (
                    <View style={[styles.system, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name={kind === 'join' ? 'log-in-outline' : 'log-out-outline'} size={13} color={kind === 'join' ? colors.success : colors.textMuted} />
                      <T variant="tiny" muted>
                        {t(kind === 'join' ? 'chat.joinedLine' : 'chat.leftLine', { name: who })} · {timeOf(item.at)}
                      </T>
                    </View>
                  );
                }
                const mine = item.userId === meId;
                const seen = mine ? seenBy(item.id) : [];
                const allSeen = mine && others.length > 0 && seen.length >= others.length;
                return (
                  <Pressable
                    onLongPress={() => !item.deleted && setPicked(item)}
                    delayLongPress={300}
                    style={[styles.msgRow, mine && { flexDirection: 'row-reverse' }]}
                  >
                    {mine ? null : <Avatar avatarKey={item.avatarKey} size={28} />}
                    <View
                      style={[
                        styles.bubble,
                        mine
                          ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                          : { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
                      ]}
                    >
                      {mine ? null : (
                        <T variant="tiny" color={colors.primary} style={{ fontFamily: fonts.semibold }}>
                          {item.name}
                        </T>
                      )}
                      {item.deleted ? (
                        <Row gap={4}>
                          <Ionicons name="ban" size={13} color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted} />
                          <T variant="small" color={mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} style={{ fontStyle: 'italic' }}>
                            {t('chat.deleted')}
                          </T>
                        </Row>
                      ) : (
                        <T color={mine ? '#fff' : colors.text}>{item.body}</T>
                      )}
                      <Row gap={3} style={{ alignSelf: 'flex-end' }}>
                        <T variant="tiny" color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted}>
                          {timeOf(item.at)}
                        </T>
                        {mine && !item.deleted ? (
                          <Ionicons
                            name={seen.length ? 'checkmark-done' : 'checkmark'}
                            size={14}
                            color={allSeen ? '#7DD3FC' : 'rgba(255,255,255,0.75)'}
                          />
                        ) : null}
                      </Row>
                    </View>
                  </Pressable>
                );
              }}
            />

            {othersTyping.length ? (
              <Row gap={6} style={styles.typingRow}>
                {othersTyping.slice(0, 3).map((x) => (
                  <Avatar key={x.userId} avatarKey={x.avatarKey} size={20} />
                ))}
                <T variant="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                  {othersTyping.length === 1
                    ? t('chat.typingOne', { name: othersTyping[0].name.split(' ')[0] })
                    : t('chat.typingMany', { count: othersTyping.length })}
                </T>
                <TypingDots color={colors.primary} />
              </Row>
            ) : null}

            {readOnly ? (
              <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: spacing.md + insets.bottom }]}>
                <T variant="tiny" muted center>
                  {t('chat.readOnly')}
                </T>
              </View>
            ) : (
              <Row style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: spacing.md + insets.bottom }]}>
                <TextInput
                  value={text}
                  onChangeText={onType}
                  placeholder={t('chat.placeholder')}
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={submit}
                  returnKeyType="send"
                  style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                />
                <Pressable
                  onPress={submit}
                  disabled={!text.trim() || send.isPending}
                  style={({ pressed }) => [styles.send, { backgroundColor: colors.primary, opacity: !text.trim() ? 0.4 : pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </Pressable>
              </Row>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}

      {/* Long press: message info (time, seen by) and delete for everyone. */}
      <Modal transparent visible={picked !== null && !confirmDelete} animationType="fade" onRequestClose={() => setPicked(null)} statusBarTranslucent>
        <Pressable style={[styles.infoBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setPicked(null)}>
          {picked ? (
            <Pressable style={[styles.infoCard, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.infoQuote, { backgroundColor: colors.surfaceAlt }]}>
                <T variant="tiny" color={colors.primary}>
                  {picked.userId === meId ? t('common.you') : picked.name}
                </T>
                <T numberOfLines={3}>{picked.body}</T>
              </View>
              <Row gap={8}>
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <T variant="small" muted>
                  {t('chat.sentAt', { time: `${new Date(picked.at).toLocaleDateString()} ${timeOf(picked.at)}` })}
                </T>
              </Row>
              {picked.userId === meId ? (
                <View style={{ gap: 6 }}>
                  <Row gap={8}>
                    <Ionicons name="checkmark-done" size={16} color="#38BDF8" />
                    <T variant="smallBold">{t('chat.seenBy', { count: seenBy(picked.id).length })}</T>
                  </Row>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {seenBy(picked.id).map((m) => (
                      <Row key={m.userId} gap={4} style={[styles.seenChip, { backgroundColor: colors.surfaceAlt }]}>
                        <Avatar avatarKey={m.avatarKey} size={20} />
                        <T variant="tiny">{m.name.split(' ')[0]}</T>
                      </Row>
                    ))}
                  </Row>
                  <Pressable onPress={() => setConfirmDelete(true)} style={[styles.infoAction, { borderTopColor: colors.border }]}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <T variant="smallBold" color={colors.error}>
                      {t('chat.deleteForEveryone')}
                    </T>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      <ConfirmModal
        visible={confirmDelete}
        icon="trash"
        gradient={BRAND_GRADIENT}
        title={t('chat.deleteForEveryone')}
        message={t('chat.deleteConfirm')}
        confirmLabel={t('room.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (picked) remove.mutate(picked.id);
          setConfirmDelete(false);
          setPicked(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: 31,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabInner: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden', elevation: 20 },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  handle: { width: 46, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: 6 },
  people: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  person: { alignItems: 'center' },
  muteDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  system: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  inputRow: { padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, includeFontPadding: false, paddingVertical: 0 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  infoBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  infoCard: { borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  infoQuote: { borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  seenChip: { borderRadius: 999, paddingLeft: 2, paddingRight: 8, paddingVertical: 2, alignItems: 'center' },
  infoAction: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: 4 },
});
