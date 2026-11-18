/**
 * Small shared building blocks. Anything used on 2+ screens lives here or in its own file
 * in components/ — screens only compose.
 */
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { goldGradient, heroGradient, radius, spacing, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Text ─────────────────────────────────────────────────────────────────────
type Variant = keyof typeof typography;

export function T({
  variant = 'body',
  muted,
  color,
  center,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  const { colors } = useThemeColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[typography[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
/**
 * Every screen. With a `title` it gets the purple gradient header, which also sits behind
 * the status bar — the status bar text is always white (App.tsx), so the area under it is
 * always the gradient. Without a title, a gradient strip still covers the status bar.
 */
export function Screen({
  children,
  scroll,
  title,
  right,
  onBack,
  padded = true,
  refreshControl,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  padded?: boolean;
  refreshControl?: React.ReactElement;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const inner = padded ? { paddingHorizontal: spacing.lg } : undefined;
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }, style]}>
      {title !== undefined ? (
        <Header title={title} right={right} onBack={onBack} />
      ) : (
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: insets.top }} />
      )}
      {/* Edge-to-edge Android doesn't resize the window for the keyboard: pad on both platforms. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[inner, { paddingTop: spacing.lg, paddingBottom: spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl as never}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingTop: spacing.lg }, inner]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Gradient header bar: back button, centered title (wraps to 2 lines if long), optional action. */
export function Header({ title, right, onBack }: { title?: string; right?: React.ReactNode; onBack?: () => void }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + spacing.md }]}
    >
      <IconButton icon="chevron-back" onPress={onBack ?? (() => navigation.goBack())} color="#fff" accessibilityLabel="back" />
      <T variant="h2" color="#fff" style={styles.headerTitle} numberOfLines={1}>
        {title ?? ''}
      </T>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </LinearGradient>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useThemeColors();
  const isDisabled = disabled || loading;
  const fg = variant === 'secondary' || variant === 'ghost' ? colors.primary : variant === 'gold' ? '#3B1D00' : colors.white;
  const content = (
    <View style={[styles.buttonInner, small && styles.buttonSmall]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[small ? typography.smallBold : typography.h3, { color: fg }]}>{title}</Text>
        </>
      )}
    </View>
  );
  const base: ViewStyle = {
    borderRadius: radius.lg,
    overflow: 'hidden',
    opacity: isDisabled ? 0.55 : 1,
  };
  if (variant === 'gold') {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [base, pressed && styles.pressed, style]}>
        <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.error
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [base, { backgroundColor: bg }, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 24,
  accessibilityLabel,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

// ─── Containers ───────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
}) {
  const { colors } = useThemeColors();
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function Row({
  children,
  style,
  gap = spacing.sm,
  onLayout,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

export function Spacer({ h = spacing.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────
/**
 * Poppins has tall built-in font padding on Android, which pushes typed text and
 * placeholders below the middle of an input. Every TextInput in the app spreads this:
 * no font padding, no lineHeight, zero vertical padding, and a fixed height so the text
 * sits exactly in the vertical centre.
 */
export const centeredInput: TextStyle = {
  includeFontPadding: false,
  textAlignVertical: 'center',
  paddingTop: 0,
  paddingBottom: 0,
  lineHeight: undefined,
};

/** Brand-coloured on/off switch (purple track, gold thumb when on) — never the default green. */
export function Toggle({
  value,
  onValueChange,
  disabled,
  onDark,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  /** On a coloured (primary) background: gold thumb on a light track so it stays visible. */
  onDark?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: onDark ? 'rgba(255,255,255,0.55)' : colors.primaryLight }}
      thumbColor={value ? (onDark ? '#FBBF24' : colors.primary) : '#f4f3f4'}
      ios_backgroundColor={colors.border}
    />
  );
}

/** Small selectable pill (multi-select options, speed choices…). */
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      {active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      <Text style={[typography.smallBold, { color: active ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string }) {
  const { colors } = useThemeColors();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <T variant="smallBold" muted style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        // Android autofill tints the field when text is pasted/filled — keep inputs as designed.
        importantForAutofill="no"
        autoComplete="off"
        style={[
          typography.bodyMedium,
          styles.input,
          centeredInput,
          { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border },
          style,
        ]}
        {...props}
      />
      {error ? (
        <T variant="small" color={colors.error} style={{ marginTop: 4 }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
}: {
  /** dot: a small red dot after the label (something new in that tab). */
  options: { value: V; label: string; dot?: boolean }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: colors.primary }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[typography.smallBold, { color: active ? colors.white : colors.text }]} numberOfLines={1}>
                {o.label}
              </Text>
              {o.dot ? <View style={styles.segDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  step = 1,
  width = 56,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  width?: number;
}) {
  const { colors } = useThemeColors();
  return (
    <Row gap={spacing.md}>
      <IconButton
        icon="remove-circle"
        size={34}
        color={value <= min ? colors.border : colors.primary}
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <T variant="h1" center style={{ width }}>
        {value}
      </T>
      <IconButton
        icon="add-circle"
        size={34}
        color={value >= max ? colors.border : colors.primary}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </Row>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
export function Loading({ label }: { label?: string }) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? (
        <T muted style={{ marginTop: spacing.md }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, action }: { icon: IconName; title: string; action?: React.ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.center, { paddingVertical: spacing.xxl }]}>
      <Ionicons name={icon} size={48} color={colors.primaryLight} />
      <T muted center style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        {title}
      </T>
      {action}
    </View>
  );
}

export function Pill({
  label,
  color,
  textColor,
  style,
}: {
  label: string;
  color: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color }, style]}>
      <Text style={[typography.tiny, { color: textColor ?? '#fff', includeFontPadding: false }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Every screen header: a little taller, back · title · action centred on one line.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md + 4,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: spacing.md, minHeight: 36 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  iconButton: { padding: 4, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, fontSize: 16 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', paddingHorizontal: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  headerTitle: { flex: 1, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  segDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
