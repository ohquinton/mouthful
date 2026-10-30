import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { normalise, preparePassage, PassageWord } from '../engine/align';
import { REVIEW_HEADER, reviewMetrics, reviewRow, ReviewMarks, toggleMark } from '../engine/review';
import { resolvePassage, sourceOf } from '../content/resolve';
import { listenerSummary, loadSessions, SavedSession, updateSession } from '../store/sessions';
import { ReplayButton } from '../components/Replay';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { fonts, space, useColors } from '../theme';
import { BRAND } from '../brand';

/**
 * Tester mode only. Listen to the recording next to what the app marked, and mark every
 * word it got wrong, including the ones the reader didn't notice. Everything stays on the phone;
 * the export is numbers only.
 */
export default function Review() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <ReviewOne id={id} /> : <ReviewList />;
}

/** Tape corrections are stored as words; fold them back into the statuses. */
function statusesFor(s: SavedSession, words: PassageWord[]): string {
  const raw = s.review?.statuses ?? '';
  const fixed = new Set((s.corrected ?? []).map(normalise));
  return raw
    .split('')
    .map((c, i) => (c === 's' && words[i] && fixed.has(words[i].key) ? 'c' : c))
    .join('');
}

function ReviewList() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<{ s: SavedSession; statuses: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(async (all) => {
        const tested = all.filter((s) => s.review).sort((a, b) => b.at - a.at);
        const out = [];
        for (const s of tested) {
          const p = await resolvePassage(s.passageId);
          out.push({ s, statuses: statusesFor(s, p ? preparePassage(p.text) : []) });
        }
        setRows(out);
      });
    }, []),
  );

  const exportAll = () => {
    const lines = [...rows]
      .reverse()
      .map(({ s, statuses }, n) =>
        reviewRow(reviewMetrics(statuses, s.review!.marks), {
          session: `${n + 1}-${sourceOf(s.passageId)}`,
          wpm: s.wpm,
          firstWordLagMs: s.review!.firstWordLagMs,
          reviewed: !!s.review!.reviewed,
        }),
      );
    Share.share({ message: [REVIEW_HEADER, ...lines].join('\n') }).catch(() => {});
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(3) }]}>
      <Header title="Review sessions" />
      <Text style={[styles.lead, { color: colors.muted }]}>
        Open each session, play the recording, and mark every word {' '}Mouthful got wrong. Then copy the numbers into the beta sheet before you reset for the next tester. The restarts and glitches line isn’t in the copy: type it in by hand.
      </Text>
      {rows.length === 0 && <Text style={[styles.lead, { color: colors.ink }]}>No tester sessions yet. Do a reading session with tester mode on.</Text>}
      {rows.map(({ s, statuses }) => {
        const m = reviewMetrics(statuses, s.review!.marks);
        return (
          <Pressable
            key={s.id}
            onPress={() => router.push({ pathname: '/review', params: { id: s.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                {new Date(s.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {m.falseRedPer100} false red /100 ·{' '}
                {s.recordings?.length ? 'recorded' : 'no audio'}
              </Text>
              {/* Not in the copied row (engine/review.ts): copy these into the sheet by hand. */}
              <Text style={[styles.rowSub, { color: colors.muted }]}>{listenerSummary(s.review)}</Text>
            </View>
            <Ionicons name={s.review!.reviewed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={s.review!.reviewed ? colors.good : colors.line} />
          </Pressable>
        );
      })}
      {rows.length > 0 && <PrimaryButton label="Copy numbers for the sheet" onPress={exportAll} />}
    </ScrollView>
  );
}

function ReviewOne({ id }: { id: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<SavedSession>();
  const [words, setWords] = useState<PassageWord[]>([]);
  const [marks, setMarks] = useState<ReviewMarks>({ said: [], notSaid: [] });
  const [showHeard, setShowHeard] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(async (all) => {
        const found = all.find((x) => x.id === id);
        if (!found?.review) return;
        const p = await resolvePassage(found.passageId);
        setWords(p ? preparePassage(p.text) : []);
        setS(found);
        setMarks(found.review.marks);
      });
    }, [id]),
  );

  const statuses = useMemo(() => (s ? statusesFor(s, words) : ''), [s, words]);
  const m = useMemo(() => reviewMetrics(statuses, marks), [statuses, marks]);

  if (!s?.review) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const save = async (reviewed: boolean) => {
    await updateSession(s.id, { review: { ...s.review!, marks, reviewed } });
    router.back();
  };

  const tiles = [
    { label: 'False red', value: `${m.falseRedPer100}`, unit: '/100 words', tone: m.falseRedPer100 > 2 ? colors.stumble : colors.good },
    { label: 'Not caught by reader', value: `${m.uncaught}`, unit: m.uncaught === 1 ? 'word' : 'words', tone: colors.ink },
    { label: 'False green', value: `${m.falseGreenPer100}`, unit: '/100 words', tone: colors.ink },
    { label: 'First-word lag', value: s.review.firstWordLagMs !== undefined ? `${s.review.firstWordLagMs}` : '–', unit: 'ms', tone: colors.ink },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(3) }]}>
      <Header title={s.title} />

      {s.recordings?.length ? (
        <ReplayButton uris={s.recordings} label="Play the recording" sub={`${s.seconds}s · ${s.wpm} wpm`} accent />
      ) : (
        <Text style={[styles.lead, { color: colors.stumble }]}>No recording for this session, so it can’t be fully reviewed.</Text>
      )}

      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: t.tone }]}>
              {t.value}
              <Text style={[styles.tileUnit, { color: colors.muted }]}> {t.unit}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.howTo, { color: colors.muted }]}>Listener: {listenerSummary(s.review)}</Text>

      <Text style={[styles.howTo, { color: colors.muted }]}>
        Tap a <Text style={{ color: colors.stumble, fontWeight: '700' }}>red</Text> word if you hear it on the recording. Tap a green or
        underlined word if it wasn’t actually said. {m.userCorrections} {m.userCorrections === 1 ? 'word was' : 'words were'} fixed by the reader
        (underlined).
      </Text>

      <View style={[styles.passage, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {words.map((w, i) => {
          const c = statuses[i];
          const markedSaid = marks.said.includes(i);
          const markedNot = marks.notSaid.includes(i);
          const color = c === 'p' ? colors.unread : c === 's' && !markedSaid ? colors.stumble : markedNot ? colors.stumble : colors.ink;
          return (
            <Pressable key={i} onPress={() => setMarks((mk) => toggleMark(statuses, mk, i))} disabled={c === 'p'} hitSlop={2}>
              <Text
                style={[
                  styles.word,
                  { color },
                  c === 'c' && { textDecorationLine: 'underline' },
                  (markedSaid || markedNot) && { backgroundColor: colors.signalSoft },
                  markedNot && { textDecorationLine: 'line-through' },
                ]}
              >
                {w.display}
                {markedSaid ? ' ✓' : ''}{' '}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => setShowHeard((v) => !v)} hitSlop={8}>
        <Text style={[styles.link, { color: colors.signal }]}>{showHeard ? 'Hide' : 'Show'} what the phone heard</Text>
      </Pressable>
      {showHeard && <Text style={[styles.heard, { color: colors.muted }]}>{s.review.transcript || '(nothing)'}</Text>}

      <PrimaryButton label="Done reviewing" onPress={() => save(true)} />
      <SecondaryButton label="Save for later" onPress={() => save(false)} />
    </ScrollView>
  );
}

function Header({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={styles.top}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={colors.ink} />
      </Pressable>
      <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.badge, { color: colors.signal, borderColor: colors.signal }]}>TESTER</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 48 },
  title: { flex: 1, fontFamily: fonts.displayBold, fontSize: 24 },
  badge: { fontSize: 11, fontWeight: '700', letterSpacing: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  lead: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: space(1.5), gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  tileValue: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: 12, fontWeight: '400' },
  howTo: { fontSize: 14, lineHeight: 20 },
  passage: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 16, padding: space(2) },
  word: { fontFamily: fonts.reading, fontSize: 20, lineHeight: 34, borderRadius: 4 },
  link: { fontSize: 15, fontWeight: '600' },
  heard: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
});
