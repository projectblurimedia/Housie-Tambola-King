import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button, IconButton, Row, T } from '@/components/ui';
import { SHOW_CATEGORIES, SHOW_CATEGORY_KEYS, SHOW_COLORS, type ShowCategoryKey } from '@/game/engine/party';
import type { PartyOptions, ShowItem } from '@/services/partyService';
import { usePartyStore, type CustomCategory } from '@/state/partyStore';
import { fonts, radius, spacing, useThemeColors } from '@/theme';
import { GOLD_EDGE } from './Premium';

/** Card n of a Show game, as {emoji, name}: from the chosen category (built-in or custom). */
export function showItem(options: PartyOptions | undefined, n: number, t: TFunction): ShowItem {
  const cat = options?.category ?? 'colors';
  if (cat === 'custom') return options?.items?.[n] ?? { n: String(n + 1) };
  const names = String(t(`party.items.${cat}`)).split('|');
  const key = (SHOW_CATEGORY_KEYS.includes(cat as ShowCategoryKey) ? cat : 'colors') as ShowCategoryKey;
  return { e: SHOW_CATEGORIES[key][n % 10] || undefined, n: names[n % 10] ?? String(n + 1) };
}

/** All items of a category (for previews). */
function itemsOf(options: PartyOptions | undefined, t: TFunction): ShowItem[] {
  if (options?.category === 'custom') return options.items ?? [];
  return Array.from({ length: 10 }, (_, i) => showItem(options, i, t));
}

/** A small preview chip: colour dot (colours) or emoji + name. */
function ItemChip({ item, index, colorsCat }: { item: ShowItem; index: number; colorsCat: boolean }) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.itemChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      {colorsCat ? <View style={[styles.dot, { backgroundColor: SHOW_COLORS[index % 10].hex }]} /> : <T style={{ fontSize: 14 }}>{item.e}</T>}
      <T variant="tiny" numberOfLines={1}>
        {item.n}
      </T>
    </View>
  );
}

/**
 * Show's card category in the lobby. The host picks a built-in set (Colours, Fruits, Animals…)
 * or one of their own, or makes a new one (3–10 items; a game needs one item per player).
 * Everyone else sees the chosen set.
 */
export function CategoryPicker({
  options,
  isHost,
  players,
  onPick,
}: {
  options: PartyOptions;
  isHost: boolean;
  players: number;
  onPick: (category: string, items: ShowItem[] | null, title: string | null) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const custom = usePartyStore((s) => s.categories);
  const remove = usePartyStore((s) => s.remove);
  const [editing, setEditing] = useState<CustomCategory | null>(null);
  const [deleting, setDeleting] = useState<CustomCategory | null>(null);
  const current = options.category ?? 'colors';
  const items = itemsOf(options, t);
  const tooFew = current === 'custom' && items.length < players;

  const tile = (key: string, title: string, emojis: string[], selected: boolean, onPress: () => void, onLong?: () => void) => (
    <Pressable key={key} onPress={onPress} onLongPress={onLong} style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }] }]}>
      <LinearGradient colors={selected ? GOLD_EDGE : [colors.border, colors.border]} style={styles.tileEdge}>
        <View style={[styles.tile, { backgroundColor: selected ? '#1E1033' : colors.surface }]}>
          <Row gap={2}>
            {emojis.slice(0, 3).map((e, i) => (
              <T key={i} style={{ fontSize: 18, lineHeight: 24 }}>
                {e}
              </T>
            ))}
          </Row>
          <T variant="tiny" numberOfLines={1} color={selected ? '#FDE68A' : colors.text} style={{ fontFamily: fonts.semibold, marginTop: 2 }}>
            {title}
          </T>
        </View>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <T variant="smallBold" muted style={{ letterSpacing: 0.6 }}>
          {t('party.cards').toUpperCase()}
        </T>
        <T variant="tiny" muted>
          {current === 'custom' ? options.title || t('party.cat.custom') : t(`party.cat.${current}`)}
        </T>
      </Row>
      {isHost ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
          {SHOW_CATEGORY_KEYS.map((k) =>
            tile(
              k,
              t(`party.cat.${k}`),
              k === 'colors' ? ['🔴', '🔵', '🟢'] : [...SHOW_CATEGORIES[k]],
              current === k,
              () => onPick(k, null, null),
            ),
          )}
          {custom.map((c) =>
            tile(
              c.id,
              c.title,
              c.items.map((i) => i.e || '•'),
              current === 'custom' && options.title === c.title,
              () => onPick('custom', c.items, c.title),
              () => setDeleting(c),
            ),
          )}
          <Pressable onPress={() => setEditing({ id: String(Date.now()), title: '', items: [{ e: '', n: '' }, { e: '', n: '' }, { e: '', n: '' }] })}>
            <View style={[styles.tile, styles.newTile, { borderColor: colors.primary }]}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <T variant="tiny" color={colors.primary} style={{ fontFamily: fonts.semibold }}>
                {t('party.newCategory')}
              </T>
            </View>
          </Pressable>
        </ScrollView>
      ) : null}
      <View style={styles.preview}>
        {items.map((it, i) => (
          <ItemChip key={i} item={it} index={i} colorsCat={current === 'colors'} />
        ))}
      </View>
      {tooFew ? (
        <T variant="tiny" color={colors.error} style={{ marginTop: 4 }}>
          {t('party.needItems', { count: players })}
        </T>
      ) : null}

      <CategoryEditor
        value={editing}
        minItems={Math.max(3, players)}
        onCancel={() => setEditing(null)}
        onSave={(c) => {
          usePartyStore.getState().save(c);
          onPick('custom', c.items, c.title);
          setEditing(null);
        }}
      />
      <ConfirmModal
        visible={deleting !== null}
        icon="trash"
        title={t('party.deleteCategory')}
        message={deleting?.title ?? ''}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (deleting) remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}

/** Make a category: a name and 3–10 items (emoji + name). */
function CategoryEditor({
  value,
  minItems,
  onCancel,
  onSave,
}: {
  value: CustomCategory | null;
  minItems: number;
  onCancel: () => void;
  onSave: (c: CustomCategory) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [draft, setDraft] = useState<CustomCategory | null>(value);
  React.useEffect(() => setDraft(value), [value]);
  if (!draft) return null;
  const items = draft.items;
  const filled = items.filter((i) => i.n.trim());
  const valid = draft.title.trim().length > 0 && filled.length >= 3 && filled.length <= 10;
  const setItem = (i: number, patch: Partial<ShowItem>) =>
    setDraft({ ...draft, items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">{t('party.newCategory')}</T>
            <IconButton icon="close" onPress={onCancel} />
          </Row>
          <TextInput
            value={draft.title}
            onChangeText={(v) => setDraft({ ...draft, title: v.slice(0, 20) })}
            placeholder={t('party.categoryName')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          />
          <T variant="tiny" muted style={{ marginTop: spacing.sm }}>
            {t('party.itemsHint', { count: minItems })}
          </T>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }} keyboardShouldPersistTaps="handled">
            {items.map((it, i) => (
              <Row key={i} gap={6}>
                <View style={[styles.swatch, { backgroundColor: SHOW_COLORS[i % 10].hex }]} />
                <TextInput
                  value={it.e ?? ''}
                  onChangeText={(v) => setItem(i, { e: [...v].slice(-2).join('') })}
                  placeholder="🙂"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.emojiInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                />
                <TextInput
                  value={it.n}
                  onChangeText={(v) => setItem(i, { n: v.slice(0, 16) })}
                  placeholder={t('party.itemName', { n: i + 1 })}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                />
                {items.length > 3 ? <IconButton icon="remove-circle" color={colors.error} onPress={() => setDraft({ ...draft, items: items.filter((_, k) => k !== i) })} /> : null}
              </Row>
            ))}
            {items.length < 10 ? (
              <Pressable onPress={() => setDraft({ ...draft, items: [...items, { e: '', n: '' }] })} style={styles.addRow}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <T variant="smallBold" color={colors.primary}>
                  {t('party.addItem')}
                </T>
              </Pressable>
            ) : null}
          </ScrollView>
          <Button
            title={t('party.saveCategory')}
            variant="gold"
            icon="checkmark"
            disabled={!valid}
            onPress={() => onSave({ ...draft, title: draft.title.trim(), items: filled.map((i) => ({ e: i.e?.trim() || undefined, n: i.n.trim() })) })}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tileEdge: { borderRadius: radius.md + 2, padding: 1.5 },
  tile: { width: 92, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  newTile: { borderWidth: 1.5, borderStyle: 'dashed', gap: 2 },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  itemChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.md },
  sheet: { borderRadius: radius.xl, padding: spacing.md },
  input: { height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 14 },
  emojiInput: { width: 52, paddingHorizontal: 0, textAlign: 'center', fontSize: 18 },
  swatch: { width: 8, height: 32, borderRadius: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, alignSelf: 'flex-start' },
});
