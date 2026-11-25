import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Svg from 'react-native-svg';
import { Avatar } from '@/components/Avatar';
import { CoinIcon } from '@/components/CoinIcon';
import { ConfirmModal } from '@/components/ConfirmModal';
import { VoicePicker } from '@/components/VoicePicker';
import { TicketStylePicker } from '@/components/TicketStylePicker';
import { CrownArt, Rays } from '@/components/Wordmark';
import { Card, Row, Screen, T, Toggle } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { errorMessage } from '@/localization/errorMessages';
import { SupportedLanguage } from '@/localization/i18n';
import { showToast } from '@/state/toastStore';
import { ThemeMode, useSettingsStore } from '@/state/settingsStore';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/config';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

type IconName = keyof typeof Ionicons.glyphMap;

/** Row colours: each setting gets its own coloured tile (easy to spot at a glance). */
const TINT = {
  voice: '#DB2777',
  caller: '#EA580C',
  sounds: '#059669',
  strike: '#0891B2',
  haptics: '#4F46E5',
  edit: '#7C3AED',
  help: '#F59E0B',
  support: '#0EA5E9',
  terms: '#64748B',
  privacy: '#10B981',
};

const LANGS: [SupportedLanguage, string, string][] = [
  ['en', 'Aa', 'English'],
  ['te', 'అ', 'తెలుగు'],
];
const THEMES: [ThemeMode, IconName, string][] = [
  ['system', 'phone-portrait', 'profile.themeSystem'],
  ['light', 'sunny', 'profile.themeLight'],
  ['dark', 'moon', 'profile.themeDark'],
];

/** A choice tile: the chosen one glows in the brand gradient with a gold edge and a tick. */
function ChoiceTile({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      {active ? (
        <LinearGradient colors={['#6D28D9', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.choice, { borderColor: '#FDE68A' }]}>
          {children}
          <Ionicons name="checkmark-circle" size={16} color="#FDE68A" style={styles.choiceTick} />
        </LinearGradient>
      ) : (
        <View style={[styles.choice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>{children}</View>
      )}
    </Pressable>
  );
}

/** A section heading: small icon + uppercase title. */
function Section({ icon, title }: { icon: IconName; title: string }) {
  const { colors } = useThemeColors();
  return (
    <Row gap={6} style={styles.sectionLabel}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <T variant="smallBold" muted style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </T>
    </Row>
  );
}

function SettingRow({ icon, label, tint, children }: { icon: IconName; label: string; tint: string; children: React.ReactNode }) {
  return (
    <Row style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={17} color="#fff" />
      </View>
      <T variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </T>
      {children}
    </Row>
  );
}

function LinkRow({ icon, label, onPress, tint, danger }: { icon: IconName; label: string; onPress: () => void; tint?: string; danger?: boolean }) {
  const { colors } = useThemeColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}>
      <View style={[styles.settingIcon, { backgroundColor: danger ? colors.error : (tint ?? colors.primary) }]}>
        <Ionicons name={icon} size={17} color="#fff" />
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
  const stats: { key: string; icon: IconName | 'coin'; value: string; label: string }[] = [
    { key: 'games', icon: 'game-controller', value: String(p?.gamesPlayed ?? 0), label: t('profile.gamesPlayed') },
    { key: 'prizes', icon: 'trophy', value: String(p?.prizesWon ?? 0), label: t('profile.prizesWon') },
    { key: 'coins', icon: 'coin', value: Number(p?.coins ?? 0).toLocaleString('en-IN'), label: t('coins.title') },
  ];

  return (
    <Screen scroll title={t('profile.title')}>
      {/* Profile card: a gradient cover with soft rays, the gold-ringed photo overlapping it,
          name + phone, an Edit button, then three stat tiles (games, prizes, coins). */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient colors={['#2A0A4F', '#6D28D9', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
          <View style={styles.rays} pointerEvents="none">
            <Rays size={520} opacity={0.1} count={22} />
          </View>
          <View style={styles.coverCrown} pointerEvents="none">
            <Svg width={34} height={27} viewBox="0 0 120 94">
              <CrownArt id="pf-cr" jewels={false} />
            </Svg>
          </View>
        </LinearGradient>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={['#FFF1A8', '#F5B700', '#B87400', '#FFE27A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
            <View style={[styles.ringGap, { backgroundColor: colors.surface }]}>
              <Avatar avatarKey={p?.avatarKey ?? 'a1'} size={92} />
            </View>
          </LinearGradient>
        </View>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.md }}>
          <T style={[styles.name, { color: colors.text }]} center numberOfLines={2}>
            {p?.displayName}
          </T>
          {phone ? (
            <Row gap={5} style={{ marginTop: 2 }}>
              <Ionicons name="call" size={12} color={colors.textMuted} />
              <T variant="small" muted>
                {phone}
              </T>
            </Row>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={({ pressed }) => [styles.editBtn, { borderColor: colors.primary }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="pencil" size={13} color={colors.primary} />
            <T variant="smallBold" color={colors.primary}>
              {t('profile.edit')}
            </T>
          </Pressable>
        </View>
        <Row gap={spacing.sm} style={{ padding: spacing.md }}>
          {stats.map((s) => (
            <View key={s.key} style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
              {s.icon === 'coin' ? (
                <CoinIcon size={30} />
              ) : (
                <LinearGradient colors={s.icon === 'trophy' ? ['#FFE27A', '#E9A400'] : ['#A78BFA', '#6D28D9']} style={styles.statIcon}>
                  <Ionicons name={s.icon} size={15} color={s.icon === 'trophy' ? '#3B1D00' : '#fff'} />
                </LinearGradient>
              )}
              <T variant="h3" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 6 }}>
                {s.value}
              </T>
              <T variant="tiny" muted numberOfLines={1}>
                {s.label}
              </T>
            </View>
          ))}
        </Row>
      </View>

      <Section icon="color-palette" title={t('profile.lookTitle')} />
      <Card>
        <T variant="smallBold" muted style={{ marginBottom: spacing.sm }}>
          {t('profile.language')}
        </T>
        <Row gap={spacing.sm}>
          {LANGS.map(([value, glyph, label]) => {
            const on = settings.language === value;
            return (
              <ChoiceTile key={value} active={on} onPress={() => changeLanguage.mutate(value)}>
                <T style={[styles.glyph, { color: on ? '#fff' : colors.primary }]} maxFontSizeMultiplier={1}>
                  {glyph}
                </T>
                <T variant="smallBold" color={on ? '#fff' : colors.text}>
                  {label}
                </T>
              </ChoiceTile>
            );
          })}
        </Row>
        <T variant="smallBold" muted style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('profile.theme')}
        </T>
        <Row gap={spacing.sm}>
          {THEMES.map(([value, icon, key]) => {
            const on = settings.themeMode === value;
            return (
              <ChoiceTile key={value} active={on} onPress={() => settings.set({ themeMode: value })}>
                <Ionicons name={icon} size={22} color={on ? '#FDE68A' : colors.primary} />
                <T variant="smallBold" color={on ? '#fff' : colors.text} numberOfLines={1}>
                  {t(key)}
                </T>
              </ChoiceTile>
            );
          })}
        </Row>
      </Card>

      <Section icon="volume-high" title={t('profile.soundVoice')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <SettingRow icon="musical-notes" label={t('profile.sounds')} tint={TINT.sounds}>
          <Toggle value={settings.sounds} onValueChange={(sounds) => settings.set({ sounds })} />
        </SettingRow>
        <SettingRow icon="radio-button-on" label={t('profile.strikeSound')} tint={TINT.strike}>
          <Toggle value={settings.strikeSound} onValueChange={(strikeSound) => settings.set({ strikeSound })} />
        </SettingRow>
        <SettingRow icon="phone-portrait" label={t('profile.haptics')} tint={TINT.haptics}>
          <Toggle value={settings.haptics} onValueChange={(haptics) => settings.set({ haptics })} />
        </SettingRow>
        {/* Calling numbers aloud, then the caller's voice, come last. */}
        <SettingRow icon="volume-high" label={t('profile.voice')} tint={TINT.voice}>
          <Toggle value={settings.voice} onValueChange={(voice) => settings.set({ voice })} />
        </SettingRow>
        <Pressable onPress={() => setVoicesOpen((v) => !v)}>
          <SettingRow icon="mic" label={t('profile.callerVoice')} tint={TINT.caller}>
            <Ionicons name={voicesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </SettingRow>
        </Pressable>
        {voicesOpen ? <VoicePicker language={settings.language} /> : null}
      </Card>

      <Section icon="grid" title={t('ticketStyle.title')} />
      <Card>
        <TicketStylePicker />
      </Card>

      <Section icon="help-buoy" title={t('profile.help')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <LinkRow icon="book" label={t('profile.howToPlay')} tint={TINT.help} onPress={() => navigation.navigate('HowToPlay')} />
        <LinkRow icon="mail" label={t('profile.support')} tint={TINT.support} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <LinkRow icon="document-text" label={t('profile.terms')} tint={TINT.terms} onPress={() => Linking.openURL(TERMS_URL)} />
        <LinkRow icon="lock-closed" label={t('profile.privacy')} tint={TINT.privacy} onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Card>

      <Section icon="person-circle" title={t('profile.account')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <LinkRow icon="create" label={t('profile.edit')} tint={TINT.edit} onPress={() => navigation.navigate('EditProfile')} />
        <LinkRow icon="log-out" label={t('profile.logout')} onPress={() => setConfirm('logout')} danger />
        <LinkRow icon="trash" label={t('profile.deleteAccount')} onPress={() => setConfirm('delete')} danger />
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
  profileCard: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cover: { height: 104, overflow: 'hidden', alignItems: 'center' },
  rays: { position: 'absolute', top: -210, left: '50%', marginLeft: -260 },
  coverCrown: { marginTop: spacing.sm },
  avatarWrap: { alignSelf: 'center', marginTop: -54 },
  ring: { padding: 3, borderRadius: 60 },
  ringGap: { padding: 3, borderRadius: 56 },
  name: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, marginTop: spacing.sm },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: radius.lg },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  choice: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1.5 },
  choiceTick: { position: 'absolute', right: 6, top: 6 },
  glyph: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
