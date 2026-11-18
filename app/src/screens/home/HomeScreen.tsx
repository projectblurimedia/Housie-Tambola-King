import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatRupees } from '@/components/Money';
import { Card, Pill, Row, T } from '@/components/ui';
import { useAppSettings, useMe } from '@/hooks/useMe';
import { roomService } from '@/services/roomService';
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
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, delay, friction: 6, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [enter, glow, delay]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }] }]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.big}>
          <Animated.View
            style={[
              styles.bigIcon,
              { transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] },
            ]}
          >
            <Ionicons name={icon} size={28} color="#fff" />
          </Animated.View>
          <T variant="h2" color="#fff" numberOfLines={1} style={{ marginTop: spacing.sm }}>
            {title}
          </T>
          <T variant="small" color="rgba(255,255,255,0.88)" numberOfLines={2}>
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
  return (
    <Card onPress={onPress} style={{ width: 220, padding: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill label={t(`kind.${room.kind}`)} color={room.kind === 'series' ? colors.pink : colors.primary} />
        {room.gameStatus === 'running' ? <Pill label={t('game.live')} color={colors.error} /> : null}
      </Row>
      <T variant="h3" numberOfLines={1} style={{ marginTop: spacing.sm }}>
        {room.title}
      </T>
      <Row gap={6} style={{ marginTop: 4 }}>
        <Avatar avatarKey={room.hostAvatar ?? 'a1'} size={18} />
        <T variant="small" muted numberOfLines={1} style={{ flex: 1 }}>
          {t('join.hostedBy', { name: room.hostName ?? '' })}
        </T>
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <T variant="smallBold" color={colors.primary}>
          {t('join.players', { count: room.memberCount, max: room.maxPlayers })}
        </T>
        <T variant="smallBold" color={colors.goldDark}>
          🎫 {formatRupees(room.ticketPrice)}
        </T>
      </Row>
    </Card>
  );
}

function MyRoomRow({ room, onPress }: { room: MyRoomSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const statusKey = room.status === 'ended' ? 'ended' : room.gameStatus ?? 'open';
  return (
    <Card onPress={onPress} style={{ paddingVertical: spacing.md }}>
      <Row>
        <View style={[styles.roomIcon, { backgroundColor: room.kind === 'series' ? colors.pink : colors.primary }]}>
          <Ionicons name={room.kind === 'series' ? 'layers' : 'grid'} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3" numberOfLines={1}>
            {room.title}
          </T>
          <T variant="small" muted>
            {room.code} · {room.kind === 'series' ? (room.totalGames >= 500 ? t('room.game', { n: room.gamesPlayed + 1 }) : t('room.gameOfSeries', { n: Math.min(room.gamesPlayed + 1, room.totalGames), total: room.totalGames })) : t('kind.normal')}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pill
            label={t(`status.${statusKey}`)}
            color={statusKey === 'running' ? colors.error : statusKey === 'ended' ? colors.textMuted : colors.success}
          />
          {room.myWon > 0 ? (
            <T variant="smallBold" color={colors.goldDark}>
              {formatRupees(room.myWon)}
            </T>
          ) : null}
        </View>
      </Row>
    </Card>
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
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <T variant="h1" color="#FDE68A" numberOfLines={1}>
                👑 {APP_NAME}
              </T>
              <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {t('home.greeting', { name: me.data?.displayName ?? '' })}
              </Text>
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

        {settings.data?.maintenance_message ? (
          <Card style={{ margin: spacing.lg, marginBottom: 0, borderColor: colors.warning }}>
            <T variant="smallBold" color={colors.warning}>
              {t('home.maintenance')}
            </T>
            <T variant="small">{settings.data.maintenance_message}</T>
          </Card>
        ) : null}

        <Row style={styles.sectionHeader}>
          <T variant="h2">{t('home.publicRooms')}</T>
          <Pressable onPress={() => navigation.navigate('JoinRoom')}>
            <T variant="smallBold" color={colors.primary}>
              {t('home.seeAll')}
            </T>
          </Pressable>
        </Row>
        {publicRooms.data?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {publicRooms.data.slice(0, 10).map((r) => (
              <PublicRoomCard key={r.id} room={r} onPress={() => openPublic(r)} />
            ))}
          </ScrollView>
        ) : (
          <T muted style={{ paddingHorizontal: spacing.lg }}>
            {t('home.publicRoomsEmpty')}
          </T>
        )}

        <Row style={styles.sectionHeader}>
          <T variant="h2">{t('home.myRooms')}</T>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {myRooms.data?.length ? (
            myRooms.data.slice(0, 8).map((r) => <MyRoomRow key={r.id} room={r} onPress={() => navigation.navigate('Room', { roomId: r.id })} />)
          ) : (
            <T muted>{t('home.myRoomsEmpty')}</T>
          )}
        </View>

        <Row style={styles.sectionHeader}>
          <T variant="h2">{t('home.more')}</T>
        </Row>
        <Row gap={spacing.sm} style={{ paddingHorizontal: spacing.lg }}>
          {(
            [
              ['megaphone', t('home.caller'), t('home.callerDesc'), () => navigation.navigate('Caller')],
              ['help-circle', t('home.howToPlay'), t('home.howToPlayDesc'), () => navigation.navigate('HowToPlay')],
            ] as [IconName, string, string, () => void][]
          ).map(([icon, title, desc, onPress]) => (
            <Card key={title} onPress={onPress} style={{ flex: 1, padding: spacing.md, alignItems: 'center' }}>
              <Ionicons name={icon} size={26} color={colors.primary} />
              <T variant="smallBold" center style={{ marginTop: 6 }}>
                {title}
              </T>
              {desc ? (
                <T variant="tiny" muted center>
                  {desc}
                </T>
              ) : null}
            </Card>
          ))}
        </Row>
      </ScrollView>
      <ConfirmModal
        visible={confirmRoom !== null}
        icon="enter-outline"
        gradient={BRAND_GRADIENT}
        title={t('join.confirmTitle', { title: confirmRoom?.title ?? '' })}
        message={t('join.confirmMessage', { host: confirmRoom?.hostName ?? '—', price: formatRupees(confirmRoom?.ticketPrice ?? 0), count: confirmRoom?.memberCount ?? 0, max: confirmRoom?.maxPlayers ?? 0 })}
        confirmLabel={t('join.join')}
        loading={joining}
        onConfirm={() => confirmRoom && joinPublic(confirmRoom)}
        onCancel={() => setConfirmRoom(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: spacing.lg, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  big: { borderRadius: radius.xl, padding: spacing.lg, minHeight: 136, elevation: 5 },
  greeting: { fontFamily: fonts.medium, fontSize: 15, color: '#fff', includeFontPadding: false },
  bigIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: { justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  roomIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
