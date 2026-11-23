import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { IconButton, Row, T } from '@/components/ui';
import { appendChat, chatKey } from '@/hooks/useRoom';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { useChatStore } from '@/state/chatStore';
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
  return (chat.data ?? []).filter((m) => (m.kind ?? 'user') === 'user' && !muted[m.userId] && m.id > lastSeen && m.userId !== meId).length;
}

/**
 * Room chat. A half-height sheet at the bottom (the game stays visible above it), opened at the
 * newest message. Join / leave lines show in the middle. With `showFab` it has its own floating
 * button (lobby); in a game it's opened from the side panel (`open` / `onClose`).
 * `readOnly` (ended rooms): history only, no send box.
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
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const muted = useChatStore((s) => s.muted);
  const toggleMute = useChatStore((s) => s.toggleMute);
  const markSeen = useChatStore((s) => s.markSeen);
  const unread = useChatUnread(roomId, meId);

  const chat = useChat(roomId);
  const visible = useMemo(() => (chat.data ?? []).filter((m) => !muted[m.userId]), [chat.data, muted]);
  const newest = chat.data?.length ? chat.data[chat.data.length - 1].id : 0;

  // Fresh messages every time it opens.
  const refetchChat = chat.refetch;
  useEffect(() => {
    if (open) refetchChat();
  }, [open, refetchChat]);

  useEffect(() => {
    if (open && newest) markSeen(roomId, newest);
  }, [open, newest, roomId, markSeen]);

  const toBottom = (animated: boolean) => listRef.current?.scrollToEnd({ animated });

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

  const others = state.members.filter((m) => m.userId !== meId);

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

      <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
          {/* The top half stays see-through: tap it to close and keep watching the game. */}
          <Pressable style={{ flex: 1 }} onPress={close} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.head}>
              <Ionicons name="chatbubbles" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <T variant="h3" color="#fff">
                  {t('chat.title')}
                </T>
                <T variant="tiny" color="rgba(255,255,255,0.8)">
                  {t('chat.members', { count: state.members.length })}
                </T>
              </View>
              <IconButton icon="close" color="#fff" onPress={close} />
            </LinearGradient>

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
              ref={listRef}
              data={visible}
              keyExtractor={(m) => String(m.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              // Always open at the latest message, and follow new ones.
              onContentSizeChange={() => toBottom(false)}
              onLayout={() => toBottom(false)}
              ListEmptyComponent={
                <View style={styles.empty}>
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
                return (
                  <View style={[styles.msgRow, mine && { flexDirection: 'row-reverse' }]}>
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
                      <T color={mine ? '#fff' : colors.text}>{item.body}</T>
                      <T variant="tiny" color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted} style={{ alignSelf: 'flex-end' }}>
                        {timeOf(item.at)}
                      </T>
                    </View>
                  </View>
                );
              }}
            />

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
                  onChangeText={(v) => setText(v.slice(0, 200))}
                  placeholder={t('chat.placeholder')}
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={submit}
                  onFocus={() => setTimeout(() => toBottom(true), 250)}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  // About half the phone: the game is still visible above.
  sheet: { height: '55%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden', elevation: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  people: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  person: { alignItems: 'center' },
  muteDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  system: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  inputRow: { padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, includeFontPadding: false, paddingVertical: 0 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
