import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { formatRupees } from '@/components/Money';
import { Button, Card, Header, Row, Screen, Segmented, Spacer, T } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { errorMessage } from '@/localization/errorMessages';
import { SupportedLanguage } from '@/localization/i18n';
import { showToast } from '@/state/toastStore';
import { ThemeMode, useSettingsStore } from '@/state/settingsStore';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/config';
import { spacing, useThemeColors } from '@/theme';

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <T variant="bodyMedium">{label}</T>
      {children}
    </Row>
  );
}

function LinkRow({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }) {
  const { colors } = useThemeColors();
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Ionicons name={icon} size={20} color={color ?? colors.primary} />
      <T variant="bodyMedium" color={color} style={{ flex: 1 }}>
        {label}
      </T>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const me = useMe();
  const settings = useSettingsStore();

  const changeLanguage = useMutation({
    mutationFn: (language: SupportedLanguage) => profileService.updateProfile({ language }),
    onMutate: (language) => settings.setLanguage(language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const logout = () =>
    Alert.alert('', t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: () => authService.signOut().catch((err) => showToast({ variant: 'error', title: errorMessage(err) })),
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () => authService.deleteAccount().catch((err) => showToast({ variant: 'error', title: errorMessage(err) })),
      },
    ]);

  const p = me.data;

  return (
    <Screen scroll>
      <Header title={t('profile.title')} />
      <Card>
        <Row gap={spacing.md}>
          <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={64} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{p?.displayName}</T>
            <Row gap={4}>
              <Ionicons name="call" size={14} color={colors.success} />
              <T variant="small" muted>
                {p?.phone ? `+${p.phone.slice(0, 2)} ${p.phone.slice(2)}` : ''}
              </T>
            </Row>
          </View>
          <Button title={t('profile.edit')} small variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
        </Row>
        <Row style={{ justifyContent: 'space-around', marginTop: spacing.lg }}>
          {[
            [t('profile.gamesPlayed'), String(p?.gamesPlayed ?? 0)],
            [t('profile.prizesWon'), String(p?.prizesWon ?? 0)],
            [t('profile.amountWon'), formatRupees(Number(p?.amountWon ?? 0))],
          ].map(([label, value]) => (
            <View key={label} style={{ alignItems: 'center' }}>
              <T variant="h2" color={colors.primary}>
                {value}
              </T>
              <T variant="tiny" muted>
                {label}
              </T>
            </View>
          ))}
        </Row>
      </Card>


      <T variant="h2" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        {t('profile.settings')}
      </T>
      <Card style={{ gap: spacing.sm }}>
        <T variant="smallBold" muted>
          {t('profile.language')}
        </T>
        <Segmented
          value={settings.language}
          onChange={(l) => changeLanguage.mutate(l)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'te', label: 'తెలుగు' },
          ]}
        />
        <T variant="smallBold" muted style={{ marginTop: spacing.sm }}>
          {t('profile.theme')}
        </T>
        <Segmented<ThemeMode>
          value={settings.themeMode}
          onChange={(themeMode) => settings.set({ themeMode })}
          options={[
            { value: 'system', label: t('profile.themeSystem') },
            { value: 'light', label: t('profile.themeLight') },
            { value: 'dark', label: t('profile.themeDark') },
          ]}
        />
        <Spacer h={spacing.xs} />
        <SettingRow label={t('profile.voice')}>
          <Switch value={settings.voice} onValueChange={(voice) => settings.set({ voice })} trackColor={{ true: colors.primary }} />
        </SettingRow>
        {settings.voice && settings.language === 'en' ? (
          <Segmented
            value={settings.callStyle}
            onChange={(callStyle) => settings.set({ callStyle })}
            options={[
              { value: 'simple', label: t('profile.callSimple') },
              { value: 'classic', label: t('profile.callClassic') },
            ]}
          />
        ) : null}
        <SettingRow label={t('profile.haptics')}>
          <Switch value={settings.haptics} onValueChange={(haptics) => settings.set({ haptics })} trackColor={{ true: colors.primary }} />
        </SettingRow>
      </Card>

      <Spacer />
      <Card style={{ paddingVertical: spacing.xs }}>
        <LinkRow icon="help-circle-outline" label={t('profile.howToPlay')} onPress={() => navigation.navigate('HowToPlay')} />
        <LinkRow icon="mail-outline" label={t('profile.support')} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <LinkRow icon="document-text-outline" label={t('profile.terms')} onPress={() => Linking.openURL(TERMS_URL)} />
        <LinkRow icon="lock-closed-outline" label={t('profile.privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
        <LinkRow icon="log-out-outline" label={t('profile.logout')} onPress={logout} color={colors.error} />
        <LinkRow icon="trash-outline" label={t('profile.deleteAccount')} onPress={deleteAccount} color={colors.error} />
      </Card>
      <T variant="tiny" muted center style={{ marginTop: spacing.lg }}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
