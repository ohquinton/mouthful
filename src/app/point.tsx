import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { tokenise } from '../engine/align';
import {
  changeBetween, EMPTY_CHECK, focusFor, measureAttempt, MIN_POINT_WORDS, nextPointTask, PART_CHECK, PART_STARTER, partsSaid,
  POINT_LIMIT_SECONDS, POINT_PARTS, pointTaskById, type PointAttempt, type PointTask, type SelfCheck,
} from '../exercises/makeYourPoint';
import { loadPointRecords, savePointRecord, type PointRecord } from '../store/practice';
import { listenLocale, useListener } from '../speech/useListener';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { noteRoughPatch } from '../rating';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { Drop } from '../components/Drop';
import { fonts, space, useColors } from '../theme';

type Stage = 'brief' | 'speak' | 'check' | 'result';

/**
 * Make your point. One question, two attempts: with the prompts showing, a self-check, then again
 * without them, and what changed. The transcript shows on the check screen to help the reader
 * remember, and is never saved. Route: /point?task=<id>; unknown or missing → the next question.
 */
export default function MakeYourPoint() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ task?: string }>();
  const { profile } = useProfile();
  const { level, onLevel } = useVoiceLevel();
  const listener = useListener([], { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });
  const [history, setHistory] = useState<PointRecord[]>([]);
  const [task, setTask] = useState<PointTask | undefined>(() => pointTaskById(params.task));
  const [stage, setStage] = useState<Stage>('brief');
  const [attempt, setAttempt] = useState<1 | 2>(1);
  const [first, setFirst] = useState<PointAttempt>();
  const [second, setSecond] = useState<PointAttempt>();
  const [check, setCheck] = useState<SelfCheck>(EMPTY_CHECK);
  const [measured, setMeasured] = useState<Omit<PointAttempt, 'check' | 'hinted'>>();
  const [said, setSaid] = useState('');
  const [hinted, setHinted] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const firstWordAt = useRef(0);
  const finishing = useRef(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    loadPointRecords().then((all) => {
      if (!live) return;
      setHistory(all);
      setTask((t) => t ?? nextPointTask(all));
    });
    return () => { live = false; };
  }, []));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const heardCount = tokenise(listener.transcript).length;
  useEffect(() => {
    if (startedAt && heardCount > 0 && !firstWordAt.current) firstWordAt.current = Date.now();
  }, [heardCount, startedAt]);

  const failed = listener.state === 'error';
  const timing = stage === 'speak' && startedAt > 0 && !failed;
  const seconds = startedAt ? (now - startedAt) / 1000 : 0;

  useEffect(() => {
    if (failed) noteRoughPatch();
  }, [failed]);

  /** Every go starts clean: transcript, clock and first word (principle 8). */
  const startAttempt = async (which: 1 | 2, override?: { allowServer?: boolean }) => {
    if (listener.state === 'listening') await listener.stop();
    listener.reset();
    firstWordAt.current = 0;
    finishing.current = false;
    setAttempt(which);
    setShowPrompts(which === 1);
    setHinted(false);
    setNotice(null);
    setStartedAt(0);
    setStage('speak');
    await listener.start(override);
    setNow(Date.now());
    setStartedAt(Date.now());
    if (task) track('session_start', { kind: 'point', where: 'point', which: task.id, step: `attempt_${which}` });
  };

  const finishAttempt = async () => {
    if (finishing.current || !startedAt) return;
    finishing.current = true;
    const endedAt = Date.now();
    await listener.stop();
    const m = measureAttempt(listener.transcript, startedAt, firstWordAt.current, endedAt);
    setStartedAt(0);
    if (m.words < MIN_POINT_WORDS) {
      noteRoughPatch();
      track('session_too_short', { spoken: m.words, kind: 'point' });
      setNotice(m.words === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${m.words} ${m.words === 1 ? 'word' : 'words'} came through. Try again a little closer to the mic.`);
      return;
    }
    setMeasured(m);
    setSaid(listener.transcript);
    setCheck(EMPTY_CHECK);
    setStage('check');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  useEffect(() => {
    if (timing && seconds >= POINT_LIMIT_SECONDS) finishAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timing, seconds]);

  const confirmCheck = async () => {
    if (!measured || !task) return;
    const done: PointAttempt = { ...measured, check, hinted };
    if (attempt === 1) {
      setFirst(done);
      setStage('brief');
      setAttempt(2);
      return;
    }
    if (!first) return;
    setSecond(done);
    setStage('result');
    const record: PointRecord = { id: `${Date.now()}`, taskId: task.id, at: Date.now(), first, second: done };
    setHistory((h) => [...h, record]);
    await savePointRecord(record);
    // Numbers and codes only: the question goes as its id; the transcript never goes.
    track('session_complete', { kind: 'point', which: task.id, parts_first: partsSaid(first.check), parts_second: partsSaid(done.check), hinted: done.hinted, words_first: first.words, words_second: done.words });
  };

  const anotherQuestion = () => {
    if (!task) return;
    setTask(nextPointTask(history, task.id));
    setFirst(undefined);
    setSecond(undefined);
    setAttempt(1);
    setStage('brief');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => startAttempt(attempt, { allowServer: true })} />;
  }

  const prompts = (
    <View style={[styles.prompts, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {POINT_PARTS.map((p) => (
        <Text key={p} style={[styles.promptLine, { color: colors.ink }]}>{PART_STARTER[p]}</Text>
      ))}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]} numberOfLines={1}>Make your point</Text>
        {timing && <Text style={[styles.timer, { color: colors.ink }]}>{Math.max(0, POINT_LIMIT_SECONDS - Math.floor(seconds))}</Text>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {!task ? (
          <Text style={[styles.body1, { color: colors.muted }]}>Finding a question…</Text>
        ) : stage === 'brief' ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{attempt === 1 ? 'FIRST TRY · WITH PROMPTS' : 'SECOND TRY · NO PROMPTS'}</Text>
            <Text style={[styles.question, { color: colors.ink }]}>{task.question}</Text>
            {attempt === 1 ? (
              <>
                <Text style={[styles.body1, { color: colors.muted }]}>Choose a side and answer out loud in three parts. There is no right answer, and short is fine.</Text>
                {prompts}
              </>
            ) : (
              first && (
                <View style={[styles.focus, { backgroundColor: colors.signalSoft }]}>
                  <Text style={[styles.focusLabel, { color: colors.ink }]}>Your focus</Text>
                  <Text style={[styles.body1, { color: colors.ink }]}>{focusFor(first.check)}</Text>
                </View>
              )
            )}
          </>
        ) : stage === 'speak' ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{attempt === 1 ? 'FIRST TRY' : 'SECOND TRY'}</Text>
            <Text style={[styles.question, { color: colors.ink }]}>{task.question}</Text>
            {showPrompts ? prompts : !failed && !notice && (
              <Pressable onPress={() => { setShowPrompts(true); setHinted(true); }} accessibilityRole="button" style={styles.link}>
                <Text style={[styles.linkText, { color: colors.signal }]}>Show the prompts</Text>
              </Pressable>
            )}
            {failed && <ListenError message={listener.error} code={listener.errorCode} onRetry={() => startAttempt(attempt)} />}
            {notice && <Text style={[styles.notice, { color: colors.ink }]}>{notice}</Text>}
          </>
        ) : stage === 'check' ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>CHECK YOUR ANSWER</Text>
            <Text style={[styles.h2, { color: colors.ink }]}>What did you include?</Text>
            {POINT_PARTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setCheck((c) => ({ ...c, [p]: !c[p] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: check[p] }}
                style={[styles.checkRow, { backgroundColor: colors.surface, borderColor: check[p] ? colors.signal : colors.line }]}
              >
                <Ionicons name={check[p] ? 'checkbox' : 'square-outline'} size={26} color={check[p] ? colors.signal : colors.muted} />
                <Text style={[styles.checkText, { color: colors.ink }]}>{PART_CHECK[p]}</Text>
              </Pressable>
            ))}
            <Text style={[styles.fine, { color: colors.muted }]}>What the phone heard (it can miss words, and it isn’t saved):</Text>
            <Text style={[styles.said, { color: colors.ink }]}>{said}</Text>
          </>
        ) : (
          first && second && (
            <>
              <View style={styles.resultHead}>
                <Drop height={64} pose="happy" />
                <Text style={[styles.h2, styles.resultLine, { color: colors.ink }]}>{changeBetween(first, second)}</Text>
              </View>
              <View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Row label="" a="First" b="Second" head colors={colors} />
                <Row label="Parts you checked" a={`${partsSaid(first.check)} of 3`} b={`${partsSaid(second.check)} of 3`} colors={colors} />
                <Row label="Started after" a={`${first.firstWordSeconds} s`} b={`${second.firstWordSeconds} s`} colors={colors} />
                <Row label="Length" a={`${first.seconds} s`} b={`${second.seconds} s`} colors={colors} />
                <Row label="Um and uh heard" a={`${first.um}`} b={`${second.um}`} colors={colors} />
              </View>
              {second.hinted && <Text style={[styles.fine, { color: colors.muted }]}>You opened the prompts on your second try. Next time, try it without them.</Text>}
              <Text style={[styles.fine, { color: colors.muted }]}>You checked the parts yourself. The phone counts words and time. It can’t judge how good your point is, and it misses some um and uh.</Text>
            </>
          )
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        {!task ? null : stage === 'brief' ? (
          <PrimaryButton label={attempt === 1 ? 'Start talking' : 'Say it again'} onPress={() => startAttempt(attempt)} />
        ) : stage === 'speak' ? (
          timing ? (
            <View style={styles.live}>
              <View style={styles.ribbon}><VoiceRibbon level={level} color={colors.signal} height={22} /></View>
              <Pressable onPress={finishAttempt} hitSlop={10} accessibilityRole="button" style={styles.finish}>
                <Text style={[styles.finishText, { color: colors.ink }]}>Finish</Text>
              </Pressable>
            </View>
          ) : notice ? (
            <PrimaryButton label="Try again" onPress={() => startAttempt(attempt)} />
          ) : failed ? null : (
            <PrimaryButton label="Getting the mic ready…" onPress={() => {}} busy />
          )
        ) : stage === 'check' ? (
          <>
            <PrimaryButton label="Continue" onPress={confirmCheck} />
            <Pressable onPress={() => startAttempt(attempt)} accessibilityRole="button" style={styles.link}>
              <Text style={[styles.quiet, { color: colors.muted }]}>Redo this try</Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton label="Try another question" onPress={anotherQuestion} />
            <SecondaryButton label="Done" onPress={close} />
          </>
        )}
      </View>
    </View>
  );
}

function Row({ label, a, b, head, colors }: { label: string; a: string; b: string; head?: boolean; colors: ReturnType<typeof useColors> }) {
  const tone = { color: head ? colors.muted : colors.ink, fontWeight: head ? ('700' as const) : ('500' as const) };
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, tone]}>{a}</Text>
      <Text style={[styles.rowValue, tone]}>{b}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 52 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  timer: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scroll: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', gap: space(2), paddingVertical: space(3) },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3 },
  question: { fontFamily: fonts.readingBold, fontSize: 30, lineHeight: 40 },
  body1: { fontSize: 17, lineHeight: 25 },
  h2: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 31 },
  prompts: { borderWidth: 1, borderRadius: 16, padding: space(2), gap: space(1.5) },
  promptLine: { fontSize: 18, lineHeight: 25, fontWeight: '600' },
  focus: { borderRadius: 16, padding: space(2), gap: space(0.5) },
  focusLabel: { fontSize: 14, fontWeight: '800' },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  linkText: { fontSize: 16, fontWeight: '700' },
  quiet: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  notice: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 14, padding: space(1.75), minHeight: 56 },
  checkText: { flex: 1, fontSize: 17, fontWeight: '600' },
  fine: { fontSize: 14, lineHeight: 20 },
  said: { fontSize: 16, lineHeight: 24 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  resultLine: { flex: 1 },
  table: { borderWidth: 1, borderRadius: 16, padding: space(2), gap: space(1.25) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  rowLabel: { flex: 1, fontSize: 15 },
  rowValue: { width: 72, fontSize: 16, textAlign: 'right', fontVariant: ['tabular-nums'] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(2), gap: space(1), minHeight: 88 },
  live: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 56 },
  ribbon: { flex: 1 },
  finish: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  finishText: { fontSize: 17, fontWeight: '700' },
});
