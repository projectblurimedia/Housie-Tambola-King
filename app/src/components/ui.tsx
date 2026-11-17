/**
 * Small shared building blocks. Anything used on 2+ screens lives here or in its own file
 * in components/ — screens only compose.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { goldGradient, radius, spacing, typography, useThemeColors } from '@/theme';

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
export function Screen({
  children,
  scroll,
  edges = ['top', 'bottom'],
  padded = true,
  refreshControl,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshControl?: React.ReactElement;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemeColors();
  const inner = padded ? { paddingHorizontal: spacing.lg } : undefined;
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingBottom: spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl as never}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, right, onBack }: { title?: string; right?: React.ReactNode; onBack?: () => void }) {
  const navigation = useNavigation();
  const { colors } = useThemeColors();
  return (
    <View style={styles.header}>
      <IconButton
        icon="chevron-back"
        onPress={onBack ?? (() => navigation.goBack())}
        color={colors.text}
        accessibilityLabel="back"
      />
      <T variant="h2" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {title ?? ''}
      </T>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
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
  const fg =
    variant === 'secondary' || variant === 'ghost' ? colors.primary : variant === 'gold' ? '#3B1D00' : colors.white;
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

export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ h = spacing.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────
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
        style={[
          typography.bodyMedium,
          styles.input,
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
  options: { value: V; label: string }[];
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
            <Text style={[typography.smallBold, { color: active ? colors.white : colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
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

export function Pill({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[typography.tiny, { color: textColor ?? '#fff' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, minHeight: 52 },
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
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', paddingHorizontal: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
