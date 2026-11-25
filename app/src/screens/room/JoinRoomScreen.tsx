import React, { useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { PullToRefresh } from '@/components/PullToRefresh';
import { partyService } from '@/services/partyService';
import { toAppError } from '@/services/errors';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { BRAND_GRADIENT, ConfirmModal } from '@/components/ConfirmModal';
import { formatRupees } from '@/components/Money';
import { Button, Card, EmptyState, Pill, Row, Screen, Spacer, T, TextField } from '@/components/ui';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, spacing, useThemeColors } from '@/theme';
import type { PublicRoomSummary } from '@/types/api';
import type { ScreenProps } from '@/navigation/types';

export function JoinRoomScreen({ navigation, route }: ScreenProps<'JoinRoom'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [code, setCode] = useState(route.params?.code ?? '');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  /** Public room waiting for "Join this room?" confirmation. */
  const [confirmRoom, setConfirmRoom] = useState<PublicRoomSummary | null>(null);
  const rooms = useQuery({ queryKey: ['publicRooms'], queryFn: roomService.listPublic, refetchInterval: 8000 });

  // Opened from a shared room link: ask to join at once (then "waiting for the host" as usual).
  const autoJoined = useRef(false);
  useEffect(() => {
    if (route.params?.auto && route.params.code && !autoJoined.current) {
      autoJoined.current = true;
      joinCode();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinCode = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const res = await roomService.joinByCode(code);
      if (res.status === 'pending') showToast({ variant: 'info', title: t('join.requestSent') });
      navigation.replace('Room', { roomId: res.roomId });
    } catch (err) {
      // Not a Housie room? It may be a party game's code (Find Seeta / Show) — same links.
      if (toAppError(err).code === 'ROOM_NOT_FOUND') {
        try {
          const partyId = await partyService.joinByCode(code);
          navigation.replace('Party', { partyId });
          return;
        } catch (partyErr) {
          if (toAppError(partyErr).code !== 'PARTY_NOT_FOUND') {
            setError(errorMessage(partyErr));
            return;
          }
        }
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const joinPublic = async (room: PublicRoomSummary) => {
    setJoining(room.id);
    try {
      if (!room.isMember) {
        const res = await roomService.joinPublic(room.id);
        if (res.status === 'pending') showToast({ variant: 'info', title: t('join.requestSent') });
      }
      navigation.replace('Room', { roomId: room.id });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
      rooms.refetch();
    } finally {
      setJoining(null);
      setConfirmRoom(null);
    }
  };

  return (
    <Screen title={t('join.title')}>
      <PullToRefresh refreshing={rooms.isRefetching} onRefresh={() => rooms.refetch()}>
      <FlatList
        data={rooms.data ?? []}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <>
            <Card style={{ backgroundColor: colors.surfaceAlt }}>
              <T variant="h3">{t('join.codeTitle')}</T>
              <Spacer h={spacing.sm} />
              <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={code}
                    onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder={t('join.codePlaceholder')}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    error={error}
                    onSubmitEditing={joinCode}
                    style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: 6, textAlign: 'center', height: 56 }}
                  />
                </View>
                <Button title={t('join.join')} onPress={joinCode} loading={loading} disabled={code.length !== 6} style={{ height: 56 }} />
              </Row>
            </Card>
            <T variant="h2" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              {t('join.publicTitle')}
            </T>
          </>
        }
        ListEmptyComponent={rooms.isLoading ? undefined : <EmptyState icon="earth-outline" title={t('join.empty')} />}
        renderItem={({ item }) => (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6}>
                  <Pill label={t(`kind.${item.kind}`)} color={item.kind === 'series' ? colors.pink : colors.primary} />
                  <Pill
                    label={item.gameStatus === 'running' ? t('join.playing') : t('join.waiting')}
                    color={item.gameStatus === 'running' ? colors.success : colors.primary}
                  />
                </Row>
                <T variant="h3" numberOfLines={1}>
                  {item.title}
                </T>
                <Row gap={6}>
                  <Avatar avatarKey={item.hostAvatar ?? 'a1'} size={18} />
                  <T variant="small" muted numberOfLines={1}>
                    {t('join.hostedBy', { name: item.hostName ?? '' })}
                  </T>
                </Row>
                <Row gap={spacing.md}>
                  <Row gap={4}>
                    <Ionicons name="people" size={14} color={colors.textMuted} />
                    <T variant="small" muted>
                      {t('join.players', { count: item.memberCount, max: item.maxPlayers })}
                    </T>
                  </Row>
                  <T variant="smallBold" color={colors.goldDark}>
                    🎫 {formatRupees(item.ticketPrice)}
                  </T>
                </Row>
              </View>
              <Button
                title={item.isMember ? t('join.open') : t('join.join')}
                variant={item.isMember ? 'primary' : 'gold'}
                small
                loading={joining === item.id}
                onPress={() => (item.isMember ? joinPublic(item) : setConfirmRoom(item))}
              />
            </Row>
          </Card>
        )}
      />
      </PullToRefresh>
      <ConfirmModal
        visible={confirmRoom !== null}
        icon="enter-outline"
        gradient={BRAND_GRADIENT}
        title={t('join.confirmTitle', { title: confirmRoom?.title ?? '' })}
        message={t('join.confirmMessage', { host: confirmRoom?.hostName ?? '—', price: formatRupees(confirmRoom?.ticketPrice ?? 0), count: confirmRoom?.memberCount ?? 0, max: confirmRoom?.maxPlayers ?? 0 })}
        confirmLabel={t('join.join')}
        loading={joining !== null}
        onConfirm={() => confirmRoom && joinPublic(confirmRoom)}
        onCancel={() => setConfirmRoom(null)}
      />
    </Screen>
  );
}
