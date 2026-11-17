import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { formatRupees } from '@/components/Money';
import { Button, Card, EmptyState, Header, Pill, Row, Screen, Spacer, T, TextField } from '@/components/ui';
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
  const rooms = useQuery({ queryKey: ['publicRooms'], queryFn: roomService.listPublic, refetchInterval: 8000 });

  const joinCode = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const roomId = await roomService.joinByCode(code);
      navigation.replace('Room', { roomId });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const joinPublic = async (room: PublicRoomSummary) => {
    setJoining(room.id);
    try {
      if (!room.isMember) await roomService.joinPublic(room.id);
      navigation.replace('Room', { roomId: room.id });
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
      rooms.refetch();
    } finally {
      setJoining(null);
    }
  };

  return (
    <Screen>
      <Header title={t('join.title')} />
      <FlatList
        data={rooms.data ?? []}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => void rooms.refetch()} tintColor={colors.primary} />}
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
                    style={{ fontFamily: fonts.display, fontSize: 26, letterSpacing: 6, textAlign: 'center' }}
                  />
                </View>
                <Button title={t('join.join')} onPress={joinCode} loading={loading} disabled={code.length !== 6} style={{ marginTop: 4 }} />
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
                    color={item.gameStatus === 'running' ? colors.error : colors.success}
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
                onPress={() => joinPublic(item)}
              />
            </Row>
          </Card>
        )}
      />
    </Screen>
  );
}
