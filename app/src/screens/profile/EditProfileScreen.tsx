import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AVATAR_KEYS } from '@/components/Avatar';
import { Button, Header, Screen, Spacer, T, TextField } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { profileService } from '@/services/profileService';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('a1');

  useEffect(() => {
    if (me.data) {
      setName(me.data.displayName);
      setAvatar(me.data.avatarKey);
    }
  }, [me.data]);

  const save = useMutation({
    mutationFn: () => profileService.updateProfile({ displayName: name, avatarKey: avatar }),
    onSuccess: (updated) => {
      qc.setQueryData(['me'], updated);
      showToast({ variant: 'success', title: t('profile.saved') });
      navigation.goBack();
    },
    onError: (err) => showToast({ variant: 'error', title: errorMessage(err) }),
  });

  return (
    <Screen scroll>
      <Header title={t('profile.edit')} />
      <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
        <Avatar avatarKey={avatar} size={96} ring={colors.gold} />
      </View>
      <TextField label={t('profile.displayName')} value={name} onChangeText={setName} maxLength={20} autoCapitalize="words" />
      <T variant="smallBold" muted style={{ marginBottom: spacing.sm }}>
        {t('profile.avatar')}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' }}>
        {AVATAR_KEYS.map((key) => (
          <Pressable key={key} onPress={() => setAvatar(key)}>
            <Avatar avatarKey={key} size={56} ring={key === avatar ? colors.primary : undefined} />
          </Pressable>
        ))}
      </View>
      <Spacer h={spacing.xl} />
      <Button title={t('common.save')} onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2} />
    </Screen>
  );
}
