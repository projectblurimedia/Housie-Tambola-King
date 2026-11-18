import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { VoicePicker } from '@/components/VoicePicker';
import { TicketStylePicker } from '@/components/TicketStylePicker';
import { formatRupees } from '@/components/Money';
import { Card, Row, Screen, Segmented, Spacer, T, Toggle } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { errorMessage } from '@/localization/errorMessages';
import { SupportedLanguage } from '@/localization/i18n';
import { showToast } from '@/state/toastStore';
import { ThemeMode, useSettingsStore } from '@/state/settingsStore';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/config';
import { fonts, heroGradient, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

type IconName = keyof typeof Ionicons.glyphMap;

function SettingRow({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Row style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <T variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </T>
      {children}
    </Row>
  );
}

function LinkRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useThemeColors();
  const tint = danger ? colors.error : colors.primary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}>
      <View style={[styles.settingIcon, { backgroundColor: danger ? 'rgba(220,38,38,0.1)' : colors.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <T variant="bodyMedium" color={danger ? colors.error : undefined} style={{ flex: 1 }}>
        {label}
      </T>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const qc = useQueryClient();
  const me = useMe();
  const settings = useSettingsStore();
  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [voicesOpen, setVoicesOpen] = useState(false);

  const changeLanguage = useMutation({
    mutationFn: (language: SupportedLanguage) => profileService.updateProfile({ language }),
    onMutate: (language) => settings.setLanguage(language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const runConfirm = async () => {
    setBusy(true);
    try {
      if (confirm === 'logout') await authService.signOut();
      else await authService.deleteAccount();
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const p = me.data;
  const phone = p?.phone ? `+${p.phone.slice(0, 2)} ${p.phone.slice(2, 7)} ${p.phone.slice(7)}` : '';
  const stats: [IconName, string, string][] = [
    ['game-controller', String(p?.gamesPlayed ?? 0), t('profile.gamesPlayed')],
    ['trophy', String(p?.prizesWon ?? 0), t('profile.prizesWon')],
    ['cash', formatRupees(Number(p?.amountWon ?? 0)), t('profile.amountWon')],
  ];

  return (
    <Screen scroll title={t('profile.title')}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.avatarWrap}>
          <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={92} ring="#FDE68A" />
          <Pressable style={styles.editBadge} onPress={() => navigation.navigate('EditProfile')} hitSlop={8}>
            <Ionicons name="pencil" size={14} color="#3B1D00" />
          </Pressable>
        </View>
        <T style={styles.name} center numberOfLines={2}>
          {p?.displayName}
        </T>
        {phone ? (
          <View style={styles.phonePill}>
            <Ionicons name="call" size={13} color="#FDE68A" />
            <T variant="smallBold" color="#fff">
              {phone}
            </T>
          </View>
        ) : null}
        <Row gap={spacing.sm} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
          {stats.map(([icon, value, label]) => (
            <View key={label} style={styles.stat}>
              <Ionicons name={icon} size={18} color="#FDE68A" />
              <T variant="h3" color="#fff" numberOfLines={1} style={{ marginTop: 4 }}>
                {value}
              </T>
              <T variant="tiny" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                {label}
              </T>
            </View>
          ))}
        </Row>
      </LinearGradient>

      <T variant="smallBold" muted style={styles.sectionLabel}>
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
        <SettingRow icon="volume-high" label={t('profile.voice')}>
          <Toggle value={settings.voice} onValueChange={(voice) => settings.set({ voice })} />
        </SettingRow>
        <Pressable onPress={() => setVoicesOpen((v) => !v)}>
          <SettingRow icon="mic" label={t('profile.callerVoice')}>
            <Ionicons name={voicesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </SettingRow>
        </Pressable>
        {voicesOpen ? <VoicePicker language={settings.language} /> : null}
        <SettingRow icon="musical-notes" label={t('profile.sounds')}>
          <Toggle value={settings.sounds} onValueChange={(sounds) => settings.set({ sounds })} />
        </SettingRow>
        <SettingRow icon="radio-button-on" label={t('profile.strikeSound')}>
          <Toggle value={settings.strikeSound} onValueChange={(strikeSound) => settings.set({ strikeSound })} />
        </SettingRow>
        <SettingRow icon="phone-portrait" label={t('profile.haptics')}>
          <Toggle value={settings.haptics} onValueChange={(haptics) => settings.set({ haptics })} />
        </SettingRow>
      </Card>

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('ticketStyle.title')}
      </T>
      <Card>
        <TicketStylePicker />
      </Card>

      <T variant="smallBold" muted style={styles.sectionLabel}>
        {t('profile.more')}
      </T>
      <Card style={{ paddingVertical: spacing.xs }}>
        <LinkRow icon="create-outline" label={t('profile.edit')} onPress={() => navigation.navigate('EditProfile')} />
        <LinkRow icon="help-circle-outline" label={t('profile.howToPlay')} onPress={() => navigation.navigate('HowToPlay')} />
        <LinkRow icon="mail-outline" label={t('profile.support')} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <LinkRow icon="document-text-outline" label={t('profile.terms')} onPress={() => Linking.openURL(TERMS_URL)} />
        <LinkRow icon="lock-closed-outline" label={t('profile.privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
        <LinkRow icon="log-out-outline" label={t('profile.logout')} onPress={() => setConfirm('logout')} danger />
        <LinkRow icon="trash-outline" label={t('profile.deleteAccount')} onPress={() => setConfirm('delete')} danger />
      </Card>
      <T variant="tiny" muted center style={{ marginTop: spacing.lg }}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </T>

      <ConfirmModal
        visible={confirm !== null}
        icon={confirm === 'delete' ? 'trash' : 'log-out'}
        title={confirm === 'delete' ? t('profile.deleteAccount') : t('profile.logout')}
        message={confirm === 'delete' ? t('profile.deleteConfirm') : t('profile.logoutConfirm')}
        confirmLabel={confirm === 'delete' ? t('profile.deleteAccount') : t('profile.logout')}
        loading={busy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  avatarWrap: { marginTop: spacing.sm },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FDE68A',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: '#fff', marginTop: spacing.md, paddingHorizontal: spacing.sm },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  settingIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
