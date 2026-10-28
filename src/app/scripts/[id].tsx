import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { deleteScript, loadScripts, Script, wordCount } from '../../content/scripts';
import { scriptChunkId } from '../../content/resolve';
import { estimateSeconds, formatDuration } from '../../content/passages';
import { loadSessions, SavedSession } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { canRehearse } from '../../pro';
import { FREE_RUN_LINE } from '../../content/moments';
import { ProBadge } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

export default function ScriptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [script, setScript] = useState<Script | null>();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [confirm, setConfirm] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScripts().then((all) => setScript(all.find((s) => s.id === id) ?? null));
      loadSessions().then(setSessions);
    }, [id]),
  );

  if (script === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (script === null) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.ink, fontSize: 17 }}>This script was deleted.</Text>
      </View>
    );
  }

  const best = (chunk: number) => {
    const runs = sessions.filter((s) => s.passageId === scriptChunkId(script.id, chunk));
    return runs.length ? Math.max(...runs.map((r) => r.score)) : undefined;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(4) }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>{script.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          Rehearse one part at a time. Each one is about a minute out loud.
        </Text>

        {script.chunks.map((c, i) => {
          const b = best(i);
          // Labels only: session/[id].tsx makes the call (canRehearse) for every way in.
          const open = canRehearse({ pro: profile.pro, sessions, passageId: scriptChunkId(script.id, i) });
          return (
            <Pressable
              key={i}
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: scriptChunkId(script.id, i) } })}
              style={({ pressed }) => [styles.part, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.partTop}>
                <Text style={[styles.partLabel, { color: colors.muted }]}>
                  PART {i + 1} · {wordCount(c)} WORDS · {formatDuration(estimateSeconds(c))}
                </Text>
                {b !== undefined ? (
                  <Text style={[styles.partBest, { color: colors.good }]}>Best {b}</Text>
                ) : !profile.pro && open ? (
                  <Text style={[styles.partBest, { color: colors.good }]}>{FREE_RUN_LINE}</Text>
                ) : null}
                {!open && <ProBadge />}
              </View>
              <Text style={[styles.partText, { color: colors.ink }]} numberOfLines={3}>
                {c}
              </Text>
              <View style={styles.partGo}>
                <Ionicons name="mic" size={16} color={colors.signal} />
                <Text style={[styles.partGoText, { color: colors.signal }]}>Rehearse</Text>
              </View>
            </Pressable>
          );
        })}

        {confirm ? (
          <View style={styles.confirmRow}>
            <Pressable
              hitSlop={8}
              onPress={async () => {
                await deleteScript(script.id);
                router.back();
              }}
            >
              <Text style={[styles.delete, { color: colors.stumble }]}>Delete this script</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setConfirm(false)}>
              <Text style={[styles.delete, { color: colors.muted }]}>Keep it</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable hitSlop={8} onPress={() => setConfirm(true)}>
            <Text style={[styles.delete, { color: colors.muted }]}>Delete script</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: space(2), height: 48, justifyContent: 'center' },
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  h1: { fontFamily: fonts.readingBold, fontSize: 28 },
  meta: { fontSize: 15, lineHeight: 21 },
  part: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(1) },
  partTop: { flexDirection: 'row', justifyContent: 'space-between' },
  partLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  partBest: { fontSize: 13, fontWeight: '700' },
  partText: { fontFamily: fonts.reading, fontSize: 16, lineHeight: 24 },
  partGo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partGoText: { fontSize: 15, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: space(3), marginTop: space(2) },
  delete: { fontSize: 16, fontWeight: '600', marginTop: space(2) },
});
