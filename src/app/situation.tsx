import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countFreeTalk, tokenise } from '../engine/align';
import { situationById, type Situation } from '../content/situations';
import {
  MIN_RESPONSE_WORDS, clearTooShort, finishCheck, heardLine, nextSituation, openStarters, readyToRespond, responseHeard, retry,
  situationCompleteProps, situationFeedback, situationRecord, stageStep, startFlow, toggleTick,
  type SituationRecord,
} from '../content/situationFlow';
import { loadSituationRecords, saveSituationRecord } from '../store/situations';
import { listenLocale, useListener } from '../speech/useListener';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { noteRoughPatch } from '../rating';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { Drop } from '../components/Drop';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { fonts, space, useColors } from '../theme';

const NO_HINTS: string[] = [];
/** A forgotten phone shouldn't leave the mic open: the answer ends by itself after this long. */
const RESPONSE_LIMIT_MS = 90_000;

/**
 * One everyday situation: example → answer with starters → answer without them → the reader's own
 * check → one thing to change next time. The steps are pure functions in content/situationFlow.ts.
 *
 * Route: /situation?id=<situation id>. An unknown or missing id picks the next one.
 *
 * What the phone heard stays in this screen's memory while the reader checks their answer. It is
 * never saved or sent. There is no automatic mark for grammar, relevance, confidence or pronunciation.
 */
export default function SituationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const { profile } = useProfile();
  const { level, onLevel } = useVoiceLevel();
  const listener = useListener(NO_HINTS, { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });

  const [situation, setSituation] = useState<Situation | null>(() => situationById(params.id) ?? null);
  const [records, setRecords] = useState<SituationRecord[]>([]);
  const [flow, setFlow] = useState(startFlow);
  const [heardText, setHeardText] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const done = useRef(false);
  // The newest transcript, so an answer ended by a final recogniser update still counts it.
  const latestTranscript = useRef('');
  useEffect(() => { latestTranscript.current = listener.transcript; }, [listener.transcript]);

  useEffect(() => {
    let live = true;
    loadSituationRecords().then((saved) => {
      if (!live) return;
      setRecords(saved);
      setSituation((current) => current ?? nextSituation(saved));
    });
    return () => { live = false; };
  }, []);

  const situationId = situation?.id;
  useEffect(() => {
    if (situationId) track('situation_start', { where: 'situation', which: situationId });
  }, [situationId]);

  const running = listener.state === 'listening';
  const failed = listener.state === 'error';
  const spoken = useMemo(() => countFreeTalk(tokenise(listener.transcript)).spoken, [listener.transcript]);
  useEffect(() => { if (failed) noteRoughPatch(); }, [failed]);

  /** Every attempt at an answer starts clean: transcript, too-short note and the stop guard (principle 8). */
  const begin = async (override?: { allowServer?: boolean }) => {
    listener.reset();
    latestTranscript.current = '';
    done.current = false;
    setHeardText('');
    setFlow(clearTooShort);
    await listener.start(override);
  };

  const finishAnswer = async () => {
    if (done.current) return;
    done.current = true;
    await listener.stop();
    const text = latestTranscript.current; // captured before the state updater below runs
    const words = countFreeTalk(tokenise(text)).spoken;
    if (words < MIN_RESPONSE_WORDS) {
      noteRoughPatch();
      track('session_too_short', { spoken: words, kind: 'situation', where: 'situation' });
    }
    setHeardText(text);
    setFlow((f) => responseHeard(f, words));
    listener.reset();
  };

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => { finishAnswer(); }, RESPONSE_LIMIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishAnswer uses refs and updaters, so an old copy is safe
  }, [running]);

  const retryAfterError = async () => {
    if (listener.state === 'listening') {
      done.current = true;
      await listener.stop();
    }
    await begin();
  };

  const resumeAfterError = async () => {
    if (done.current) return;
    track('session_resume', { where: 'situation', error: listener.errorCode });
    await listener.resume();
  };

  const moveTo = (next: Situation) => {
    listener.reset();
    setHeardText('');
    setSaveFailed(false);
    setFlow(startFlow());
    setSituation(next);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => begin({ allowServer: true })} />;
  }
  if (!situation) return <View style={[styles.screen, { backgroundColor: colors.bg }]} />;

  const finishCheckStep = async () => {
    const record = situationRecord(situation, flow, Date.now());
    setFlow(finishCheck);
    setRecords((all) => [...all, record]);
    track('situation_complete', situationCompleteProps(record));
    setSaveFailed(!(await saveSituationRecord(record)));
  };

  const tryAgain = () => {
    track('situation_retry', { where: 'situation', which: situation.id, attempt: flow.attempt + 1 });
    listener.reset();
    setHeardText('');
    setSaveFailed(false);
    setFlow(retry);
  };

  const answering = flow.stage === 'supported' || flow.stage === 'independent';
  const { step, label } = stageStep(flow.stage);
  const onResult = flow.stage === 'result';
  const feedback = situationFeedback(situation, flow);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]} numberOfLines={1}>{onResult ? 'Your result' : `Step ${step} of 4 · ${label}`}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.line }]}>
        <View style={[styles.fill, { backgroundColor: colors.clear, width: `${onResult ? 100 : ((step - 1) / 4) * 100}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{situation.title}</Text>
        {!onResult && <Text style={[styles.task, { color: colors.ink }]}>{situation.task}</Text>}

        {flow.stage === 'example' && (
          <View style={styles.group}>
            <Text style={[styles.label, { color: colors.muted }]}>Read these aloud, or read them on screen</Text>
            {situation.examples.map((line) => <Text key={line} style={[styles.phrase, { color: colors.ink }]}>{line}</Text>)}
          </View>
        )}

        {answering && (
          <>
            <View style={[styles.other, { backgroundColor: colors.clearSoft }]}>
              <Text style={[styles.label, { color: colors.ink }]}>They say</Text>
              <Text style={[styles.phrase, { color: colors.ink }]}>{situation.otherSays}</Text>
            </View>
            {flow.stage === 'supported' || flow.startersOpened ? (
              <View style={styles.group}>
                <Text style={[styles.label, { color: colors.muted }]}>You could start with</Text>
                {situation.starters.map((line) => <Text key={line} style={[styles.starter, { color: colors.ink }]}>{line}</Text>)}
              </View>
            ) : (
              <Pressable onPress={() => setFlow(openStarters)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.quiet, { color: colors.clear }]}>Show the starters</Text>
              </Pressable>
            )}
            {running && spoken > 0 && (
              <View style={styles.group}>
                <Text style={[styles.label, { color: colors.muted }]}>What the phone heard</Text>
                <Text style={[styles.heard, { color: colors.ink }]}>{listener.transcript}</Text>
              </View>
            )}
            {failed ? (
              <ListenError message={listener.error} code={listener.errorCode} onRetry={retryAfterError} onResume={listener.canResume ? resumeAfterError : undefined} />
            ) : flow.tooShort !== null && !running && (
              <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.ink }]}>
                {flow.tooShort === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${flow.tooShort} ${flow.tooShort === 1 ? 'word' : 'words'} came through. Try again a little closer to the mic.`}
              </Text>
            )}
          </>
        )}

        {flow.stage === 'selfcheck' && (
          <>
            <View style={styles.group}>
              <Text style={[styles.label, { color: colors.muted }]}>What the phone heard (it can miss words)</Text>
              <Text style={[styles.heard, { color: colors.ink }]}>{heardText}</Text>
            </View>
            <View style={styles.group}>
              <Text style={[styles.label, { color: colors.muted }]}>Tick what you did. Only you can check this.</Text>
              {situation.checks.map((check) => {
                const ticked = flow.ticks.includes(check.id);
                return (
                  <Pressable key={check.id} onPress={() => setFlow((f) => toggleTick(f, check.id))} accessibilityRole="checkbox" accessibilityState={{ checked: ticked }}
                    style={[styles.check, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                    <Ionicons name={ticked ? 'checkbox' : 'square-outline'} size={26} color={ticked ? colors.clear : colors.muted} />
                    <Text style={[styles.checkText, { color: colors.ink }]}>{check.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {onResult && (
          <>
            <Drop height={84} pose="up" alive />
            <View style={[styles.other, { backgroundColor: colors.clearSoft }]}>
              <Text style={[styles.nextTime, { color: colors.ink }]}>{feedback.nextTime}</Text>
            </View>
            <View style={styles.group}>
              <Text style={[styles.fact, { color: colors.ink }]}>{feedback.selfChecked}</Text>
              <Text style={[styles.fact, { color: colors.ink }]}>{feedback.starters}</Text>
              <Text style={[styles.fact, { color: colors.ink }]}>{heardLine(flow.independentWords)}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>The ticks are your own. The phone counts words it heard. It does not mark your grammar or how you sound.</Text>
              {saveFailed && <Text style={[styles.small, { color: colors.muted }]}>Couldn’t save this result. Your next one will try again.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        {flow.stage === 'example' && (
          <>
            <PrimaryButton label="I’m ready to answer" onPress={() => setFlow(readyToRespond)} />
            <Pressable onPress={() => moveTo(nextSituation(records, situation.id))} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.quiet, { color: colors.muted }]}>Different situation</Text>
            </Pressable>
          </>
        )}
        {answering && (running ? (
          <View style={styles.liveFooter}>
            <View style={styles.ribbon}><VoiceRibbon level={level} color={colors.clear} height={22} /></View>
            <Pressable onPress={finishAnswer} hitSlop={10} accessibilityRole="button" style={styles.finish}>
              <Text style={[styles.finishText, { color: colors.ink }]}>Done</Text>
            </Pressable>
          </View>
        ) : !failed && (
          <PrimaryButton
            label={listener.state === 'asking' ? 'Getting the mic ready…' : flow.tooShort !== null ? 'Try again' : 'Start answering'}
            onPress={() => begin()}
            busy={listener.state === 'asking'}
          />
        ))}
        {flow.stage === 'selfcheck' && <PrimaryButton label="See what to try next" onPress={finishCheckStep} />}
        {onResult && (
          <>
            <PrimaryButton label="Try again" onPress={tryAgain} />
            <SecondaryButton label="Next situation" onPress={() => moveTo(nextSituation(records, situation.id))} />
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.quiet, { color: colors.muted }]}>Finish for now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 52 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  body: { gap: space(2.5), paddingVertical: space(3) },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 37 },
  task: { fontSize: 18, lineHeight: 26 },
  group: { gap: space(1) },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  phrase: { fontFamily: fonts.reading, fontSize: 20, lineHeight: 29 },
  starter: { fontFamily: fonts.reading, fontSize: 18, lineHeight: 26 },
  other: { borderRadius: 18, padding: space(2), gap: space(0.75) },
  heard: { fontSize: 16, lineHeight: 23 },
  notice: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  check: { flexDirection: 'row', alignItems: 'center', gap: space(1.25), minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: space(1.5), paddingVertical: space(1) },
  checkText: { flex: 1, fontSize: 16, lineHeight: 22 },
  nextTime: { fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 28 },
  fact: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(2), gap: space(1.5), alignItems: 'stretch', minHeight: 88 },
  liveFooter: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 56 },
  ribbon: { flex: 1 },
  finish: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  finishText: { fontSize: 17, fontWeight: '700' },
  quiet: { fontSize: 16, fontWeight: '600', textAlign: 'center', padding: space(0.5) },
});
