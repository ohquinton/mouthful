import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadScripts, Script, wordCount } from '../../content/scripts';
import { loadSessions, SavedSession } from '../../store/sessions';
import { PrimaryButton, Row } from '../../components/ui';
import { useProfile } from '../../store/profile';
import { canAddScript, requirePro } from '../../pro';
import { fonts, space, useColors } from '../../theme';
import { BRAND } from '../../brand';

export default function Scripts() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadScripts().then(setScripts);
      loadSessions().then(setSessions);
    }, []),
  );

  // The first script is free; a second one opens the scripts soft wall.
  const paste = () => {
    if (!canAddScript({ pro: profile.pro, scriptCount: scripts.length }) && !requirePro(profile, 'scripts')) return;
    router.push('/scripts/new');
  };

  const bestFor = (s: Script) => {
    const runs = sessions.filter((x) => x.passageId.startsWith(`s.${s.id}.`));
    return runs.length ? Math.max(...runs.map((r) => r.score)) : undefined;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(3) }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>Your scripts</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Paste what you actually have to say: a presentation, a toast, a video script. {BRAND.name} splits it into
          short parts you can rehearse with Glide.
        </Text>
        <PrimaryButton label="Paste a script" onPress={paste} />

        {scripts.map((s) => {
          const words = s.chunks.reduce((n, c) => n + wordCount(c), 0);
          const best = bestFor(s);
          return (
            <Row
              key={s.id}
              title={s.title}
              meta={`${words} words · ${s.chunks.length} ${s.chunks.length === 1 ? 'part' : 'parts'}${best ? ` · best ${best}` : ''}`}
              onPress={() => router.push({ pathname: '/scripts/[id]', params: { id: s.id } })}
            />
          );
        })}
        {scripts.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>No scripts yet. Your next big meeting is a good first one.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: space(2), height: 48, justifyContent: 'center' },
  wrap: { paddingHorizontal: space(2.5), gap: space(1.75) },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  lead: { fontSize: 16, lineHeight: 23 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: space(2) },
});
