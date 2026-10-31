import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { align, normalise, preparePassage, tokenise, wordsMatch } from '../engine/align';
import { loadDrillItems, type DrillItem } from '../content/drill';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { DICTIONARY } from '../content/wordpacks';
import { getSession } from '../store/sessions';
import { recordWords } from '../store/words';
import { useProfile } from '../store/profile';
import { markStep } from '../plan';
import { track } from '../analytics';
import { noteRoughPatch } from '../rating';
import { listenLocale, useListener } from '../speech/useListener';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { WordReflection } from '../components/WordReflection';
import { ListenError } from '../components/ListenError';
import { fonts, space, useColors } from '../theme';

type Item = DrillItem;
type Phase = 'alone' | 'sentence';
type DrillResult = { alone: number; sentence: number };

/**
 * Two steps per word:
 *   1. say it on its own (does the recogniser hear it clearly?)
 *   2. say it inside a real sentence (can you use it in flow?)
 * Only step 2 counts toward "comfortable". Neither is a pronunciation grade, and the
 * app says so rather than pretending.
 */
export default function FixIt() {
  const { words: raw, title, sid, step } = useLocalSearchParams<{ words?: string; title?: string; sid?: string; step?: string }>();
  // A new request owns fresh loading, drill and completion state, even on a reused route.
  return <DrillRequest key={JSON.stringify([raw, sid, title, step])} raw={raw} sid={sid} title={title} step={step} />;
}

function DrillRequest({ raw, sid, title, step }: { raw?: string; sid?: string; title?: string; step?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [items, setItems] = useState<Item[] | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadDrillItems(raw, sid, getSession).then(
      (loaded) => { if (live) setItems(loaded); },
      () => { if (live) setError(true); },
    );
    return () => { live = false; };
  }, [raw, sid, attempt]);

  // Never mount the microphone-owning component for loading, failed or empty content.
  if (!items || items.length === 0) return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.completion, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(3) }]}>
      <View style={styles.doneWrap}>
        <Text accessibilityRole="header" style={[styles.doneTitle, { color: colors.ink }]}>{error ? 'Couldn’t load this practice' : items ? 'No words to practise here' : 'Getting your words ready…'}</Text>
        <Text style={[styles.meaning, { color: colors.muted }]}>{error ? 'Please try again, or choose a word pack from the Library.' : items ? 'Choose a word pack from the Library to start a new practice.' : 'Your practice will open when the words are ready.'}</Text>
        {error && <PrimaryButton label="Try again" onPress={() => { setError(false); setAttempt(attempt + 1); }} />}
        {(error || items) && <PrimaryButton label="Go to Library" onPress={() => router.replace('/(tabs)/library')} />}
        <SecondaryButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/library')} />
      </View>
    </ScrollView>
  );
  // Removing Drill also removes its listener and aborts native recognition before reflection.
  if (result) return <DrillComplete items={items} result={result} />;
  return <Drill items={items} title={title} onFinished={() => markStep(profile, update, step)} onComplete={setResult} insetsBottom={insets.bottom} />;
}

function Drill({ items, title, onFinished, onComplete, insetsBottom }: { items: Item[]; title?: string; onFinished: () => void; onComplete: (result: DrillResult) => void; insetsBottom: number }) {
  const colors = useColors();
  const { profile } = useProfile();
  const { level, onLevel } = useVoiceLevel();
  const hints = useMemo(() => items.map((i) => i.word), [items]);
  const listener = useListener(hints, { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('alone');
  const [heardFrom, setHeardFrom] = useState(0); // ignore transcript from before this step
  const [cleared, setCleared] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const score = useRef({ alone: 0, sentence: 0 });
  const finished = useRef(false);

  useEffect(() => {
    listener.start();
    return () => {
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = items[i];
  const info = item ? DICTIONARY.get(item.word.toLowerCase()) : undefined;
  const tokens = useMemo(() => tokenise(listener.transcript).slice(heardFrom), [listener.transcript, heardFrom]);
  const sentenceWords = useMemo(() => preparePassage(item?.sentence ?? ''), [item]);
  const sentenceAlign = useMemo(() => align(sentenceWords, tokens), [sentenceWords, tokens]);
  const targetIdx = sentenceWords.findIndex((w) => w.key === normalise(item?.word ?? ''));

  const aloneHit = phase === 'alone' && !!item && !speaking && tokens.some((t) => wordsMatch(t, normalise(item.word)));
  const sentenceHit = phase === 'sentence' && sentenceAlign.done && !speaking;
  const sentenceClean = sentenceHit && (targetIdx < 0 || sentenceAlign.status[targetIdx] === 'read');

  const advance = () => {
    if (finished.current) return;
    setCleared(false);
    setHeardFrom(tokenise(listener.transcript).length);
    if (phase === 'alone' && item?.sentence) {
      setPhase('sentence');
      return;
    }
    setPhase('alone');
    if (i + 1 >= items.length) {
      finished.current = true;
      listener.stop();
      track('drill_complete', { words: items.length, alone: score.current.alone, sentence: score.current.sentence });
      onFinished();
      onComplete({ ...score.current });
    } else setI(i + 1);
  };

  // Heard it: record once.
  useEffect(() => {
    if (cleared || !item) return;
    if (aloneHit) {
      // Reacting to what the recogniser heard; `cleared` guards it so it records once per step.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the hit comes from the recogniser (outside React), and the guard stops a cascade
      setCleared(true);
      score.current.alone++;
      recordWords([{ word: item.word, clean: true, where: 'alone' }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (sentenceHit) {
      setCleared(true);
      if (sentenceClean) score.current.sentence++;
      recordWords([{ word: item.word, clean: sentenceClean, where: 'context' }]);
      Haptics.notificationAsync(sentenceClean ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aloneHit, sentenceHit, cleared]);

  // Then move on, in its own effect so setting `cleared` doesn't cancel the timer.
  useEffect(() => {
    if (!cleared) return;
    const t = setTimeout(advance, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared, i, phase]);

  const hear = (text: string) => {
    setSpeaking(true);
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.85,
      onDone: () => {
        setHeardFrom(tokenise(listener.transcript).length); // ignore anything the mic heard from the speaker
        setSpeaking(false);
      },
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // The recogniser stopped for good (e.g. it can't listen for this English). A routine error
  // while it's still listening restarts by itself, so it shows nothing.
  const failed = listener.state === 'error';
  // No rating ask in a launch where the recogniser let them down (rating.ts).
  useEffect(() => {
    if (failed) noteRoughPatch();
  }, [failed]);

  /** Start listening again from a clean page. The step stays where it was. */
  const retryListening = async () => {
    if (listener.state === 'listening') await listener.stop();
    listener.reset();
    setHeardFrom(0); // the transcript starts empty again
    setCleared(false);
    await listener.start(); // awaited so ListenError keeps Try again disabled until the mic is starting
  };

  /**
   * Carry on after the recogniser stopped: listen again on the same word and step. The
   * transcript is kept, so `heardFrom` still points past what was heard before.
   */
  const resumeListening = async () => {
    track('session_resume', { where: 'fixit', error: listener.errorCode });
    await listener.resume();
  };

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => listener.start({ allowServer: true })} />;
  }

  if (!item) return null;

  const stepLabel = phase === 'alone' ? 'Say it on its own' : 'Now say it in a sentence';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingBottom: insetsBottom }]}>
      <Text style={[styles.step, { color: colors.muted }]}>
        {title ? `${title} · ` : ''}
        {i + 1} of {items.length}
      </Text>

      <Animated.View key={`${i}-${phase}`} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(160)} style={styles.card}>
        {phase === 'alone' ? (
          <>
            <Text style={[styles.word, { color: cleared ? colors.good : colors.ink }]}>{item.word}</Text>
            {info && <Text style={[styles.syllables, { color: colors.signal }]}>{info.syllables}</Text>}
            {info && <Text style={[styles.meaning, { color: colors.ink }]}>{info.meaning}</Text>}
          </>
        ) : (
          <Text style={styles.sentence}>
            {sentenceWords.map((w, k) => (
              <Text
                key={k}
                style={{
                  color:
                    sentenceAlign.status[k] === 'read'
                      ? colors.ink
                      : sentenceAlign.status[k] === 'skipped'
                        ? colors.stumble
                        : colors.unread,
                  fontFamily: k === targetIdx ? fonts.readingBold : fonts.reading,
                  textDecorationLine: k === targetIdx ? 'underline' : 'none',
                  textDecorationColor: colors.signal,
                }}
              >
                {w.display}{' '}
              </Text>
            ))}
          </Text>
        )}
      </Animated.View>

      <Pressable
        onPress={() => hear(phase === 'alone' ? item.word : item.sentence ?? item.word)}
        accessibilityLabel={phase === 'alone' ? `Hear how to say ${item.word}` : 'Hear the sentence'}
        style={({ pressed }) => [styles.hear, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={speaking ? 'volume-high' : 'volume-medium-outline'} size={20} color={colors.signal} />
        <Text style={[styles.hearText, { color: colors.ink }]}>{speaking ? 'Playing…' : 'Hear it'}</Text>
      </Pressable>

      {failed ? (
        <View style={styles.errorWrap}>
          <ListenError
            message={listener.error}
            code={listener.errorCode}
            onRetry={retryListening}
            onResume={listener.canResume ? resumeListening : undefined}
          />
        </View>
      ) : (
        <View style={styles.listenRow}>
          <VoiceRibbon level={level} color={cleared ? colors.good : colors.signal} />
          <Text style={[styles.hint, { color: cleared ? colors.good : colors.muted }]}>
            {cleared
              ? phase === 'sentence' && !sentenceClean
                ? 'Almost. The word didn’t come through clearly.'
                : 'Heard clearly.'
              : speaking
                ? ' '
                : listener.state === 'listening'
                  ? stepLabel
                  : 'Getting the mic ready…'}
          </Text>
        </View>
      )}

      <View style={[styles.bottom, { bottom: insetsBottom + 32 }]}>
        <Pressable onPress={advance} hitSlop={8}>
          <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
        </Pressable>
        <Pressable onPress={close} hitSlop={8}>
          <Text style={[styles.skipText, { color: colors.muted }]}>End drill</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** No listener, recording or persistence in this optional reflection. */
function DrillComplete({ items, result }: { items: Item[]; result: DrillResult }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reflecting, setReflecting] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const words = [...new Set(items.map((item) => item.word.toLowerCase()))]
    .map((word) => DICTIONARY.get(word)).filter((entry) => !!entry?.practice);
  const word = words[wordIndex];
  const withSentence = items.filter((item) => item.sentence).length;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.completion, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(3) }]}>
      <View style={styles.doneWrap}>
        {reflecting && word ? (
          <>
            <Text style={[styles.word, { color: colors.ink }]}>{word.word}</Text>
            <WordReflection key={word.word} word={word} />
            {words.length > 1 && <Pressable accessibilityRole="button" onPress={() => setWordIndex((wordIndex + 1) % words.length)} style={styles.reflectionButton}>
              <Text style={[styles.hearText, { color: colors.signal }]}>Try another word</Text>
            </Pressable>}
          </>
        ) : (
          <>
            <Text style={[styles.doneTitle, { color: colors.ink }]}>{result.alone} of {items.length} heard clearly</Text>
            {withSentence > 0 && <Text style={[styles.doneSub, { color: colors.ink }]}>{result.sentence} of {withSentence} heard in a sentence</Text>}
            <Text style={[styles.hint, { color: colors.muted, textAlign: 'center' }]}>A word becomes comfortable after it’s heard in context on three different days.</Text>
            <Text style={[styles.fine, { color: colors.muted }]}>Checked with speech recognition. This isn’t a pronunciation grade or a measure of using the word spontaneously.</Text>
            {word && <Pressable accessibilityRole="button" onPress={() => setReflecting(true)} style={styles.reflectionButton}>
              <Text style={[styles.hearText, { color: colors.signal }]}>Use it yourself</Text>
            </Pressable>}
          </>
        )}
        <Pressable accessibilityRole="button" onPress={close} style={[styles.doneBtn, { backgroundColor: colors.button }]}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  completion: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space(3) },
  reflectionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space(2) },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(3), gap: space(2.5) },
  step: { fontSize: 15 },
  card: { alignItems: 'center', gap: space(1), maxWidth: 360 },
  word: { fontFamily: fonts.readingBold, fontSize: 44, textAlign: 'center' },
  syllables: { fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
  meaning: { fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: space(1) },
  sentence: { fontSize: 24, lineHeight: 36, textAlign: 'center' },
  hear: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: 10, minHeight: 44 },
  hearText: { fontSize: 16, fontWeight: '600' },
  listenRow: { alignItems: 'center', gap: space(1) },
  errorWrap: { alignSelf: 'stretch', maxWidth: 420 },
  hint: { fontSize: 17 },
  fine: { fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 320 },
  bottom: { position: 'absolute', left: space(4), right: space(4), flexDirection: 'row', justifyContent: 'space-between' },
  skipText: { fontSize: 16, fontWeight: '600' },
  doneWrap: { alignItems: 'center', gap: space(1.5) },
  doneTitle: { fontSize: 24, fontWeight: '700' },
  doneSub: { fontSize: 17, fontWeight: '600' },
  doneBtn: { borderRadius: 16, paddingHorizontal: space(5), paddingVertical: 15, marginTop: space(2) },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
