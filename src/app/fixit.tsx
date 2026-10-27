import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { align, normalise, preparePassage, tokenise, wordsMatch } from '../engine/align';
import { DICTIONARY } from '../content/wordpacks';
import { getSession } from '../store/sessions';
import { recordWords } from '../store/words';
import { useProfile } from '../store/profile';
import { markStep } from '../plan';
import { track } from '../analytics';
import { listenLocale, useListener } from '../speech/useListener';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { fonts, space, useColors } from '../theme';

type Item = { word: string; sentence?: string };
type Phase = 'alone' | 'sentence';

/**
 * Two steps per word:
 *   1. say it on its own (does the recogniser hear it clearly?)
 *   2. say it inside a real sentence (can you use it in flow?)
 * Only step 2 counts toward "comfortable". Neither is a pronunciation grade, and the
 * app says so rather than pretending.
 */
export default function FixIt() {
  const { words: raw, title, sid, step } = useLocalSearchParams<{ words?: string; title?: string; sid?: string; step?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    (async () => {
      const contexts = sid ? (await getSession(sid))?.stumbledContext ?? {} : {};
      const list = sid ? Object.keys(contexts).length ? Object.keys(contexts) : (await getSession(sid))?.stumbled ?? [] : (raw ?? '').split(',').filter(Boolean);
      setItems(
        list.map((w) => ({ word: w, sentence: DICTIONARY.get(w.toLowerCase())?.example ?? contexts[w] })),
      );
    })();
  }, [raw, sid]);

  if (!items) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Drill items={items} title={title} onFinished={() => markStep(profile, update, step)} insetsBottom={insets.bottom} />;
}

function Drill({ items, title, onFinished, insetsBottom }: { items: Item[]; title?: string; onFinished: () => void; insetsBottom: number }) {
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
  const [done, setDone] = useState(false);
  const score = useRef({ alone: 0, sentence: 0 });

  useEffect(() => {
    listener.start();
    return () => {
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = items[i];
  const info = item ? DICTIONARY.get(item.word.toLowerCase()) : undefined;
  const tokens = tokenise(listener.transcript).slice(heardFrom);
  const sentenceWords = useMemo(() => preparePassage(item?.sentence ?? ''), [item]);
  const sentenceAlign = useMemo(() => align(sentenceWords, tokens), [sentenceWords, tokens.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetIdx = sentenceWords.findIndex((w) => w.key === normalise(item?.word ?? ''));

  const aloneHit = phase === 'alone' && !!item && !speaking && tokens.some((t) => wordsMatch(t, normalise(item.word)));
  const sentenceHit = phase === 'sentence' && sentenceAlign.done && !speaking;
  const sentenceClean = sentenceHit && (targetIdx < 0 || sentenceAlign.status[targetIdx] === 'read');

  const advance = () => {
    setCleared(false);
    setHeardFrom(tokenise(listener.transcript).length);
    if (phase === 'alone' && item?.sentence) {
      setPhase('sentence');
      return;
    }
    setPhase('alone');
    if (i + 1 >= items.length) {
      listener.stop();
      setDone(true);
      track('drill_complete', { words: items.length, alone: score.current.alone, sentence: score.current.sentence });
      onFinished();
    } else setI(i + 1);
  };

  // Heard it: record once.
  useEffect(() => {
    if (cleared || !item) return;
    if (aloneHit) {
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

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => listener.start({ allowServer: true })} />;
  }

  if (done) {
    const withSentence = items.filter((x) => x.sentence).length;
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.good} />
          <Text style={[styles.doneTitle, { color: colors.ink }]}>
            {score.current.alone} of {items.length} heard clearly
          </Text>
          {withSentence > 0 && (
            <Text style={[styles.doneSub, { color: colors.ink }]}>
              {score.current.sentence} of {withSentence} said cleanly in a sentence
            </Text>
          )}
          <Text style={[styles.hint, { color: colors.muted, textAlign: 'center' }]}>
            Say a word cleanly in a sentence on three different days and it becomes comfortable.
          </Text>
          <Text style={[styles.fine, { color: colors.muted }]}>
            Checked with speech recognition. It shows whether your phone heard the word clearly. It isn’t a
            pronunciation grade.
          </Text>
          <Pressable onPress={close} style={[styles.doneBtn, { backgroundColor: colors.button }]}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
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

const styles = StyleSheet.create({
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
