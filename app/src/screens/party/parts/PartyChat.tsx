import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { Row, T } from '@/components/ui';
import { partyChatKey } from '@/hooks/useParty';
import { partyService, type PartyChatMessage } from '@/services/partyService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { FIXED_SHAPE_SCALE } from '@/utils/fontScaleCap';

/**
 * Chat for a party game: a floating button (bottom-left, with an unread count) that opens a
 * sheet — newest messages at the bottom, mine on the right in gold. Messages arrive live
 * (useParty puts them straight into this list).
 */
export function PartyChat({ partyId, meId }: { partyId: string; meId: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const chat = useQuery({ queryKey: partyChatKey(partyId), queryFn: () => partyService.chat(partyId), staleTime: 30_000 });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  const messages = chat.data ?? [];
  const newest = messages.length ? messages[messages.length - 1].id : 0;
  const unread = useMemo(() => messages.filter((m) => m.id > seenId && m.userId !== meId).length, [messages, seenId, meId]);

  useEffect(() => {
    if (open) setSeenId(newest);
  }, [open, newest]);
  useEffect(() => {
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, slide]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await partyService.sendChat(partyId, body);
      qc.setQueryData<PartyChatMessage[]>(partyChatKey(partyId), (old) => (old?.some((m) => m.id === msg.id) ? old : [...(old ?? []), msg]));
      setText('');
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} accessibilityLabel={t('chat.title')}>
        <LinearGradient colors={['#7C3AED', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
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

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + spacing.sm,
                transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
              },
            ]}
          >
            <Row style={styles.head}>
              <Ionicons name="chatbubbles" size={18} color={colors.primary} />
              <T variant="h3" style={{ flex: 1 }}>
                {t('chat.title')}
              </T>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={[styles.close, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </Row>
            <FlatList
              data={reversed}
              inverted
              keyExtractor={(m) => String(m.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: 8 }}
              ListEmptyComponent={
                <T muted center style={{ transform: [{ scaleY: -1 }] }}>
                  {t('chat.empty')}
                </T>
              }
              renderItem={({ item }) => {
                const mine = item.userId === meId;
                return (
                  <Row gap={6} style={{ justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                    {mine ? null : <Avatar avatarKey={item.avatarKey} size={26} />}
                    <View style={[styles.bubble, mine ? styles.mine : { backgroundColor: colors.surfaceAlt }]}>
                      {mine ? null : (
                        <T variant="tiny" color={colors.primary} style={{ fontFamily: fonts.semibold }}>
                          {item.name}
                        </T>
                      )}
                      <T variant="small" color={mine ? '#3B1D00' : colors.text}>
                        {item.body}
                      </T>
                      <T variant="tiny" color={mine ? 'rgba(59,29,0,0.6)' : colors.textMuted} style={{ alignSelf: 'flex-end' }}>
                        {new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </T>
                    </View>
                  </Row>
                );
              }}
            />
            <Row gap={8} style={{ paddingHorizontal: spacing.md }}>
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, 200))}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={send}
                returnKeyType="send"
                style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
              />
              <Pressable onPress={send} disabled={!text.trim() || sending} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                <LinearGradient colors={['#FFF1A8', '#F5B700', '#D97706']} style={[styles.send, { opacity: text.trim() ? 1 : 0.5 }]}>
                  <Ionicons name="send" size={18} color="#3B1D00" />
                </LinearGradient>
              </Pressable>
            </Row>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', left: spacing.lg, zIndex: 20 },
  fabInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', elevation: 6 },
  badge: { position: 'absolute', right: -2, top: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '62%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  head: { gap: 8, padding: spacing.md, paddingBottom: spacing.sm },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, gap: 1 },
  mine: { backgroundColor: '#FDE68A' },
  input: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
