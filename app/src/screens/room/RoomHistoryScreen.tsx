import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, T } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { roomService } from '@/services/roomService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { spacing } from '@/theme';
import type { ScreenProps } from '@/navigation/types';
import { StandingsList } from './parts/StandingsList';

/**
 * A room this player played in but has left (or was removed from): their standings and the
 * game-by-game table stay visible here — read only — until the room is cleaned up.
 */
export function RoomHistoryScreen({ route, navigation }: ScreenProps<'RoomHistory'>) {
  const { roomId, title } = route.params;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useMe();
  const remove = useMutation({
    mutationFn: () => roomService.hideRoom(roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myRooms'] });
      showToast({ variant: 'success', title: t('room.removedFromMine') });
      navigation.goBack();
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });
  return (
    <Screen scroll title={title}>
      <Card style={{ padding: spacing.md, marginBottom: spacing.md }}>
        <T variant="small" muted>
          {t('room.historyNote')}
        </T>
      </Card>
      {me.data ? <StandingsList roomId={roomId} meId={me.data.id} /> : null}
      <View style={{ marginTop: spacing.lg }}>
        <Button title={t('room.delete')} variant="ghost" icon="trash-outline" loading={remove.isPending} onPress={() => remove.mutate()} />
      </View>
    </Screen>
  );
}
