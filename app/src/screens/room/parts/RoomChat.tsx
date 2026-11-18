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

/**
 * Floating chat button (bottom-right, above the host's pause button in a game) with an
 * unread badge, and the chat window: messages, send box, and a strip of players where this
 * phone can mute anyone it doesn't want to hear from.
 */
export function RoomChat({ state, meId, raised }: { state: RoomState; meId: string; raised: boolean }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const roomId = state.room.id;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const muted = useChatStore((s) => s.muted);
  const toggleMute = useChatStore((s) => s.toggleMute);
  const lastSeen = useChatStore((s) => s.lastSeen[roomId] ?? 0);
  const markSeen = useChatStore((s) => s.markSeen);

  const chat = useQuery({ queryKey: chatKey(roomId), queryFn: () => roomService.getChat(roomId), staleTime: 60_000 });
  const visible = useMemo(() => (chat.data ?? []).filter((m) => !muted[m.userId]), [chat.data, muted]);
  const unread = visible.filter((m) => m.id > lastSeen && m.userId !== meId).length;
  const newest = chat.data?.length ? chat.data[chat.data.length - 1].id : 0;

  useEffect(() => {
    if (open && newest) markSeen(roomId, newest);
  }, [open, newest, roomId, markSeen]);

  useEffect(() => {
    if (open) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [open, visible.length]);

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
      <Pressable
        onPress={() => setOpen(true)}
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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <Pressable style={{ flex: 0.12 }} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.head}>
              <Ionicons name="chatbubbles" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <T variant="h3" color="#fff">
                  {t('chat.title')}
                </T>
                <T variant="tiny" color="rgba(255,255,255,0.8)">
                  {t('chat.members', { count: state.members.length })}
                </T>
              </View>
              <IconButton icon="close" color="#fff" onPress={() => setOpen(false)} />
            </LinearGradient>

            {others.length ? (
              <View style={[styles.people, { borderBottomColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.md }}>
                  {others.map((m) => {
                    const off = !!muted[m.userId];
                    return (
                      <Pressable key={m.userId} onPress={() => toggleMute(m.userId)} style={styles.person} accessibilityLabel={off ? t('chat.unmute') : t('chat.mute')}>
                        <View style={{ opacity: off ? 0.45 : 1 }}>
                          <Avatar avatarKey={m.avatarKey} size={40} />
                        </View>
                        <View style={[styles.muteDot, { backgroundColor: off ? colors.error : colors.success, borderColor: colors.surface }]}>
                          <Ionicons name={off ? 'volume-mute' : 'volume-high'} size={11} color="#fff" />
                        </View>
                        <T variant="tiny" muted numberOfLines={1} style={{ maxWidth: 56 }}>
                          {m.name.split(' ')[0]}
                        </T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <T variant="tiny" muted center style={{ marginTop: 4 }}>
                  {t('chat.muteHint')}
                </T>
              </View>
            ) : null}

            <FlatList
              ref={listRef}
              data={visible}
              keyExtractor={(m) => String(m.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <T style={{ fontSize: 40, lineHeight: 50 }}>💬</T>
                  <T muted center>
                    {chat.isLoading ? t('common.loading') : t('chat.empty')}
                  </T>
                </View>
              }
              renderItem={({ item }) => {
                const mine = item.userId === meId;
                return (
                  <View style={[styles.msgRow, mine && { flexDirection: 'row-reverse' }]}>
                    {mine ? null : <Avatar avatarKey={item.avatarKey} size={30} />}
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

            <Row style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: spacing.lg + insets.bottom }]}>
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, 200))}
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
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { flex: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  people: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  person: { alignItems: 'center', gap: 2 },
  muteDot: { position: 'absolute', top: 26, right: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  inputRow: { padding: spacing.sm, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 46, borderRadius: 23, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, includeFontPadding: false, paddingVertical: 0 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
