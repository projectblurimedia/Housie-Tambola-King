import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { Wordmark } from '@/components/Wordmark';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatRupees } from '@/components/Money';
import { Card, IconButton, Pill, Row, T } from '@/components/ui';
import { useAppSettings, useMe } from '@/hooks/useMe';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { APP_NAME } from '@/constants/config';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { MyRoomSummary, PublicRoomSummary } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';

type IconName = keyof typeof Ionicons.glyphMap;

function BigAction({
  icon,
  title,
  desc,
  colors,
  onPress,
  delay,
}: {
  icon: IconName;
  title: string;
  desc: string;
  colors: readonly [string, string];
  onPress: () => void;
  delay: number;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, delay, friction: 6, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(zoom, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, zoom, delay]);
  return (
    <Animated.View
      style={{ flex: 1, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.qaTile, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qaGradient}>
          {/* A large faded copy of the icon, gently zooming in and out. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.qaWatermark, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] }]}
          >
            <Ionicons name={icon} size={86} color="rgba(255,255,255,0.17)" />
          </Animated.View>
          <View style={styles.qaIcon}>
            <Ionicons name={icon} size={18} color="#fff" />
          </View>
          <T variant="bodyMedium" color="#fff" numberOfLines={1} style={styles.qaLabel}>
            {title}
          </T>
          <T variant="tiny" color="rgba(255,255,255,0.85)" numberOfLines={1}>
            {desc}
          </T>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function PublicRoomCard({ room, onPress }: { room: PublicRoomSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const series = room.kind === 'series';
  const live = room.gameStatus === 'running';
  const full = room.memberCount >= room.maxPlayers;
  const fill = Math.min(1, room.memberCount / Math.max(1, room.maxPlayers));
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pubCard,
        { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {/* Coloured band: mode + status. */}
      <LinearGradient
        colors={series ? ['#F472B6', '#DB2777'] : ['#8B5CF6', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pubBand}
      >
        <Row gap={6}>
          <View style={styles.pubBandIcon}>
            <Ionicons name={series ? 'layers' : 'grid'} size={14} color="#fff" />
          </View>
          <T variant="smallBold" color="#fff">
            {t(`kind.${room.kind}`)}
          </T>
        </Row>
        <View style={[styles.pubStatus, { backgroundColor: live ? '#EF4444' : 'rgba(255,255,255,0.22)' }]}>
          {live ? <View style={styles.pubLiveDot} /> : null}
          <T variant="tiny" color="#fff">
            {live ? t('game.live') : t('status.open')}
          </T>
        </View>
      </LinearGradient>

      <View style={{ padding: spacing.md, gap: 8 }}>
        <T variant="h3" numberOfLines={1}>
          {room.title}
        </T>
        {/* Seats taken. */}
        <View style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={4}>
              <Ionicons name="people" size={13} color={colors.textMuted} />
              <T variant="tiny" muted>
                {t('join.players', { count: room.memberCount, max: room.maxPlayers })}
              </T>
            </Row>
            {full ? (
              <T variant="tiny" color={colors.error}>
                {t('join.full')}
              </T>
            ) : null}
          </Row>
          <View style={[styles.pubBar, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 3, backgroundColor: full ? colors.error : colors.success }}
            />
          </View>
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <View style={[styles.pubPrice, { backgroundColor: 'rgba(245,183,0,0.14)' }]}>
            <T variant="smallBold" color={colors.goldDark}>
              🎫 {formatRupees(room.ticketPrice)}
            </T>
          </View>
          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pubJoin}>
            <T variant="tiny" color="#fff">
              {room.isMember ? t('join.open') : t('join.join')}
            </T>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </LinearGradient>
        </Row>
      </View>
    </Pressable>
  );
}

function MyRoomRow({ room, onPress }: { room: MyRoomSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const left = room.isMember === false;
  const statusKey = left ? 'left' : room.status === 'ended' ? 'ended' : (room.gameStatus ?? 'open');

  const live = statusKey === 'running';
  const statusColor = live ? colors.error : statusKey === 'ended' ? colors.textMuted : colors.success;
  const series = room.kind === 'series';
  return (
    <Card onPress={onPress} style={styles.roomCard}>
      <Row gap={spacing.md}>
        <LinearGradient
          colors={series ? ['#F472B6', '#DB2777'] : ['#8B5CF6', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.roomTile}
        >
          <Ionicons name={series ? 'layers' : 'grid'} size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, gap: 5 }}>
          <Row gap={6}>
            <T variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {room.title}
            </T>
            {room.isHost ? <T style={{ fontSize: 14, lineHeight: 18 }}>👑</T> : null}
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <View style={[styles.chip, { backgroundColor: series ? 'rgba(219,39,119,0.12)' : 'rgba(109,40,217,0.12)' }]}>
              <T variant="tiny" color={series ? '#DB2777' : colors.primary}>
                {series ? t('kind.series') : t('kind.normal')}
              </T>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="key" size={10} color={colors.textMuted} />
              <T variant="tiny" muted>
                {room.code}
              </T>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="people" size={11} color={colors.textMuted} />
              <T variant="tiny" muted>
                {room.memberCount}
              </T>
            </View>
          </Row>
        </View>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          {live ? <View style={[styles.liveDot, { backgroundColor: statusColor }]} /> : null}
          <T variant="tiny" color={statusColor}>
            {t(`status.${statusKey}`)}
          </T>
        </View>
      </Row>
    </Card>
  );
}

// Cards peeking out under the front one, like a stack of iPhone notifications (as in NearbyU).
const PEEK_CARDS = 2;
const PEEK_OFFSET = 9;
const PEEK_SHRINK = 0.05;

/**
 * "My rooms" on Home: a heading with "See all · N", the latest room in front and up to two
 * cards peeking out underneath — so many rooms never push the rest of Home down. See all opens
 * every room in a separate full-screen list.
 */
/** Home section heading, the same everywhere: gradient icon · title · thin rule · See all · N. */
function SectionHeading({ icon, title, count, onSeeAll }: { icon: IconName; title: string; count?: number; onSeeAll?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Row gap={10} style={{ marginBottom: 10 }}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headIcon}>
        <Ionicons name={icon} size={15} color="#fff" />
      </LinearGradient>
      <T variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </T>
      <View style={[styles.rule, { backgroundColor: `${colors.primary}1F` }]} />
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          style={({ pressed }) => [
            styles.seeAll,
            { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10`, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <T variant="smallBold" color={colors.primary}>
            {t('home.seeAll')}
          </T>
          {count !== undefined ? (
            <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seeAllCount}>
              <T variant="tiny" color="#fff">
                {count}
              </T>
            </LinearGradient>
          ) : null}
        </Pressable>
      ) : null}
    </Row>
  );
}

function MyRoomsStack({ rooms, onOpen }: { rooms: MyRoomSummary[]; onOpen: (room: MyRoomSummary) => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [listOpen, setListOpen] = useState(false);
  const [frontHeight, setFrontHeight] = useState(0);
  const front = rooms[0];
  const behind = rooms.slice(1, 1 + PEEK_CARDS);

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
      <SectionHeading
        icon="albums"
        title={t('home.myRooms')}
        count={rooms.length || undefined}
        onSeeAll={rooms.length ? () => setListOpen(true) : undefined}
      />

      {front ? (
        <View style={{ paddingBottom: behind.length * PEEK_OFFSET }}>
          {/* The cards behind, smaller and lower, drawn first so the front card covers them. */}
          {frontHeight > 0
            ? behind
                .map((room, index) => {
                  const depth = index + 1;
                  return (
                    <View
                      key={room.id}
                      pointerEvents="none"
                      style={[
                        styles.peek,
                        {
                          height: frontHeight,
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: depth === 1 ? 0.9 : 0.7,
                          transform: [{ translateY: depth * PEEK_OFFSET }, { scaleX: 1 - depth * PEEK_SHRINK }],
                        },
                      ]}
                    />
                  );
                })
                .reverse()
            : null}
          <View onLayout={(e) => setFrontHeight(e.nativeEvent.layout.height)}>
            <MyRoomRow room={front} onPress={() => (rooms.length > 1 ? setListOpen(true) : onOpen(front))} />
          </View>
        </View>
      ) : (
        <T muted>{t('home.myRoomsEmpty')}</T>
      )}

      <Modal visible={listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.listHeader, { paddingTop: insets.top + 12 }]}
          >
            <IconButton icon="chevron-back" color="#fff" onPress={() => setListOpen(false)} />
            <View style={{ flex: 1 }}>
              <T variant="h2" color="#fff">
                {t('home.myRooms')}
              </T>
              <T variant="tiny" color="rgba(255,255,255,0.85)">
                {t('home.roomsCount', { count: rooms.length })}
              </T>
            </View>
          </LinearGradient>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}>
            {rooms.map((r) => (
              <MyRoomRow
                key={r.id}
                room={r}
                onPress={() => {
                  setListOpen(false);
                  onOpen(r);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  // Keeps the last cards above the phone's Back / Home / Recents bar.
  const insets = useSafeAreaInsets();
  const me = useMe();
  const settings = useAppSettings();
  const publicRooms = useQuery({ queryKey: ['publicRooms'], queryFn: roomService.listPublic, refetchInterval: 15000 });
  const myRooms = useQuery({ queryKey: ['myRooms'], queryFn: roomService.myRooms });
  // Home stays loaded behind a room: refresh "My rooms" every time we come back to it
  // (a series restarted, moved on or ended while we were inside).
  const refetchMyRooms = myRooms.refetch;
  useFocusEffect(
    React.useCallback(() => {
      refetchMyRooms();
    }, [refetchMyRooms]),
  );

  const refresh = () => {
    me.refetch();
    publicRooms.refetch();
    myRooms.refetch();
  };

  const [confirmRoom, setConfirmRoom] = useState<PublicRoomSummary | null>(null);
  const [joining, setJoining] = useState(false);
  const joinPublic = async (room: PublicRoomSummary) => {
    setJoining(true);
    await roomService.joinPublic(room.id).catch(() => undefined);
    setJoining(false);
    setConfirmRoom(null);
    navigation.navigate('Room', { roomId: room.id });
  };
  // Members go straight in; anyone else confirms "Join this room?" first.
  const openPublic = (room: PublicRoomSummary) => {
    if (room.isMember) navigation.navigate('Room', { roomId: room.id });
    else setConfirmRoom(room);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={heroGradient} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          {/* One icon + "Housie Tambola King" on one line; photo on the right. */}
          <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Wordmark
                size="small"
                subtitle={(() => {
                  const first = (me.data?.displayName ?? '').trim().split(/\s+/)[0];
                  return first ? t('home.greeting', { name: first }) : t('home.greetingNoName');
                })()}
              />
            </View>
            <Pressable onPress={() => navigation.navigate('Profile')}>
              <Avatar avatarKey={me.data?.avatarKey ?? 'a1'} size={46} ring="#FDE68A" />
            </Pressable>
          </Row>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl + insets.bottom }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Row gap={spacing.md} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'stretch' }}>
          <BigAction
            icon="add-circle"
            title={t('home.createRoom')}
            desc={t('home.createRoomDesc')}
            colors={['#F59E0B', '#EA580C']}
            delay={0}
            onPress={() => navigation.navigate('CreateRoom')}
          />
          <BigAction
            icon="enter"
            title={t('home.joinRoom')}
            desc={t('home.joinRoomDesc')}
            colors={['#EC4899', '#9333EA']}
            delay={120}
            onPress={() => navigation.navigate('JoinRoom')}
          />
        </Row>

        <Row gap={spacing.md} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          {(
            [
              ['megaphone', t('home.caller'), t('home.callerDesc'), '#DB2777', () => navigation.navigate('Caller')],
              ['book', t('home.howToPlay'), t('home.howToPlayDesc'), '#2563EB', () => navigation.navigate('HowToPlay')],
            ] as [IconName, string, string, string, () => void][]
          ).map(([icon, title, desc, tint, onPress]) => (
            <Pressable
              key={title}
              onPress={onPress}
              style={({ pressed }) => [
                styles.pickCard,
                { backgroundColor: colors.surface, borderColor: `${tint}40`, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <LinearGradient colors={[`${tint}26`, `${tint}10`]} style={styles.pickIcon}>
                <Ionicons name={icon} size={18} color={tint} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <T variant="smallBold" numberOfLines={1}>
                  {title}
                </T>
                <T variant="tiny" muted numberOfLines={1}>
                  {desc}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={14} color={tint} />
            </Pressable>
          ))}
        </Row>

        {settings.data?.maintenance_message ? (
          <Card style={{ margin: spacing.lg, marginBottom: 0, borderColor: colors.warning }}>
            <T variant="smallBold" color={colors.warning}>
              {t('home.maintenance')}
            </T>
            <T variant="small">{settings.data.maintenance_message}</T>
          </Card>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <SectionHeading
            icon="earth"
            title={t('home.publicRooms')}
            count={publicRooms.data?.length || undefined}
            onSeeAll={() => navigation.navigate('JoinRoom')}
          />
        </View>
        {publicRooms.data?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {publicRooms.data.slice(0, 10).map((r) => (
              <PublicRoomCard key={r.id} room={r} onPress={() => openPublic(r)} />
            ))}
          </ScrollView>
        ) : (
          <T muted style={{ paddingHorizontal: spacing.lg }}>
            {t('home.publicRoomsEmpty')}
          </T>
        )}

        <MyRoomsStack
          rooms={myRooms.data ?? []}
          onOpen={(r) =>
            r.isMember === false ? navigation.navigate('RoomHistory', { roomId: r.id, title: r.title }) : navigation.navigate('Room', { roomId: r.id })
          }
        />
      </ScrollView>
      <ConfirmModal
        visible={confirmRoom !== null}
        icon="enter-outline"
        gradient={BRAND_GRADIENT}
        title={t('join.confirmTitle', { title: confirmRoom?.title ?? '' })}
        message={t('join.confirmMessage', {
          host: confirmRoom?.hostName ?? '—',
          price: formatRupees(confirmRoom?.ticketPrice ?? 0),
          count: confirmRoom?.memberCount ?? 0,
          max: confirmRoom?.maxPlayers ?? 0,
        })}
        confirmLabel={t('join.join')}
        loading={joining}
        onConfirm={() => confirmRoom && joinPublic(confirmRoom)}
        onCancel={() => setConfirmRoom(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  qaTile: { borderRadius: 20, overflow: 'hidden' },
  qaGradient: { height: 116, padding: 14, justifyContent: 'flex-end' },
  qaWatermark: { position: 'absolute', right: -12, bottom: -14 },
  qaIcon: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: { fontSize: 15 },
  pickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pickIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pubCard: { width: 240, borderRadius: radius.lg + 2, borderWidth: 1, overflow: 'hidden' },
  pubBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pubBandIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pubStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pubLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  pubBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  pubPrice: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pubJoin: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roomCard: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  roomTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rule: { flex: 1, height: 1, minWidth: 8 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 11,
    paddingRight: 3,
  },
  seeAllCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  peek: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: radius.lg, borderWidth: 1.5 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  hero: { paddingBottom: spacing.lg, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  // No elevation: Android's shadow turns into a dark smear when a system dialog dims the screen.
  big: { borderRadius: radius.xl, padding: spacing.md + 2, minHeight: 118 },
  greeting: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', includeFontPadding: false },
  bigIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLine: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  smallTile: { flex: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  smallTileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  roomIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
