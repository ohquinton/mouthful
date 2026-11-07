import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DICTIONARY } from '../content/wordpacks';
import { daysToNextRecall, dueForRecall, heardWordIn, ownSentenceCheck } from '../engine/vocab';
import { loadBook, saveOwnSentence, saveRecallAnswer } from '../store/words';
import { listenLocale, useListener } from '../speech/useListener';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { fonts, space, useColors } from '../theme';

const hasMeaning = (word: string) => DICTIONARY.has(word);
const leave = () => (router.canGoBack() ? router.back() : router.replace('/words'));

/**
 * Try a word from memory: its meaning without the word, then a sentence of the reader's own.
 * "Remembered" and "my own sentence" are the reader's marks, and the screen says so. The phone only
 * reports whether it heard the word, and the reader can overrule that (principle 2).
 * What was said stays in memory for this screen and is never saved.
 */
export default function Recall() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Read once, so a word answered today can't move the list under the reader.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    loadBook().then((book) => {
      if (!live) return;
      setQueue(dueForRecall(book, hasMeaning));
      setNextIn(daysToNextRecall(book, hasMeaning));
    });
    return () => { live = false; };
  }, []);

  if (queue && queue.length > 0) return <RecallRound words={queue} />;

  const later = nextIn === null
    ? 'Practise a word pack and its words will come back here for you to try from memory.'
    : nextIn === 1 ? 'Your next word comes back tomorrow.' : `Your next word comes back in ${nextIn} days.`;
  return (
    <View style={[styles.message, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <Text accessibilityRole="header" style={[styles.h1, { color: colors.ink }]}>{queue ? 'Nothing to remember today' : 'Getting your words ready…'}</Text>
      {queue && <Text style={[styles.body, { color: colors.muted }]}>{later} Only words from packs come back, because they have a meaning to start from.</Text>}
      {queue && <PrimaryButton label="Back to your words" onPress={leave} />}
    </View>
  );
}

type Phase =
  | 'meaning' // the meaning, no word: say it or show it
  | 'saying' // listening for the word
  | 'revealed' // the word is shown: I remembered / Not yet
  | 'sentence' // ready to say a sentence of their own, no example visible
  | 'speaking' // listening to the sentence
  | 'checked'; // what the phone heard, the overrule and the self-check

function RecallRound({ words }: { words: string[] }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { level, onLevel } = useVoiceLevel();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('meaning');
  const [missed, setMissed] = useState(false); // tried to say it and the phone didn't hear the word
  const [overruled, setOverruled] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [tally, setTally] = useState({ remembered: 0, ownSentences: 0 });
  const [finished, setFinished] = useState(false);
  // Guards double taps and the auto-stop while the mic takes up to 1.5 s to stop.
  const stopRequested = useRef(false);
  // A second tap while an answer saves would count it twice or skip a word.
  const saving = useRef(false);

  const word = words[index];
  const info = DICTIONARY.get(word);
  // The word helps the recogniser catch a rare word; the same list as Fix-it's drill uses it.
  const hints = useMemo(() => [word], [word]);
  const listener = useListener(hints, { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });

  // Derived from the live transcript, so a final result arriving as the mic stops still counts.
  const sayHeard = useMemo(() => heardWordIn(word, listener.transcript), [word, listener.transcript]);
  const check = useMemo(() => ownSentenceCheck(word, listener.transcript), [word, listener.transcript]);

  const listening = phase === 'saying' || phase === 'speaking';
  // The listener stays in 'error' until the next start, so a skipped word must not inherit the card.
  const failed = listening && listener.state === 'error';

  useEffect(() => () => { Speech.stop(); }, []);

  /** Every attempt starts clean (principle 8): transcript, overrule and guards. */
  const listen = async (next: 'saying' | 'speaking', override?: { allowServer?: boolean }) => {
    stopRequested.current = false;
    listener.reset();
    setOverruled(false);
    setMissed(false);
    setPhase(next);
    await listener.start(override);
  };

  const stopThen = async (after: Phase | 'missed') => {
    if (stopRequested.current) return;
    stopRequested.current = true;
    setStopping(true);
    await listener.stop();
    setStopping(false);
    if (after === 'missed') {
      setMissed(true);
      setPhase('meaning');
    } else {
      setPhase(after);
    }
  };

  // Show the word as soon as the phone hears it. The reader doesn't need to press anything.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the recogniser (outside React); guarded by stopRequested
    if (phase === 'saying' && listener.state === 'listening' && sayHeard) stopThen('revealed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, listener.state, sayHeard]);

  const retryAfterError = async () => {
    await listener.stop();
    await listen(phase === 'speaking' ? 'speaking' : 'saying');
  };

  const answer = async (remembered: boolean) => {
    if (saving.current) return;
    saving.current = true;
    await saveRecallAnswer(word, remembered);
    saving.current = false;
    track('recall_answer', { remembered, heard: sayHeard });
    if (remembered) setTally((t) => ({ ...t, remembered: t.remembered + 1 }));
    Speech.stop();
    listener.reset();
    setPhase('sentence');
  };

  const nextWord = (ownSentences: number) => {
    Speech.stop();
    listener.reset();
    setOverruled(false);
    setMissed(false);
    stopRequested.current = false;
    if (index + 1 >= words.length) {
      track('recall_complete', { count: words.length, remembered: tally.remembered, own_sentences: ownSentences });
      setFinished(true);
      return;
    }
    setPhase('meaning');
    setIndex(index + 1);
  };

  const confirmOwnSentence = async () => {
    if (saving.current) return;
    saving.current = true;
    await saveOwnSentence(word);
    saving.current = false;
    const ownSentences = tally.ownSentences + 1;
    setTally((t) => ({ ...t, ownSentences }));
    track('recall_own_sentence', { heard: check.heard, overruled, own: true });
    nextWord(ownSentences);
  };

  const notOwnSentence = () => {
    track('recall_own_sentence', { heard: check.heard, overruled, own: false });
    nextWord(tally.ownSentences);
  };

  const overrule = () => {
    setOverruled(true);
    // Which word stays on the phone: this only says the phone missed one.
    track('recognition_correction', { where: 'recall' });
  };

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => listen(phase === 'speaking' ? 'speaking' : 'saying', { allowServer: true })} />;
  }

  if (finished) {
    return (
      <View style={[styles.message, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
        <Text accessibilityRole="header" style={[styles.h1, { color: colors.ink }]}>That’s all for today</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          You marked {tally.remembered} of {words.length} {words.length === 1 ? 'word' : 'words'} as remembered, and {tally.ownSentences} {tally.ownSentences === 1 ? 'sentence' : 'sentences'} as your own. These are your marks, not a test result. Words come back after a few days, and sooner if you marked Not yet.
        </Text>
        <PrimaryButton label="Back to your words" onPress={leave} />
      </View>
    );
  }

  const wordShown = phase !== 'meaning' && phase !== 'saying';
  const sentenceOk = check.heard || overruled;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={leave} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>Word {index + 1} of {words.length}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body2}>
        {wordShown && (
          <View style={styles.wordRow}>
            <Text style={[styles.word, { color: colors.ink }]}>{word}</Text>
            <Pressable
              onPress={() => { Speech.stop(); Speech.speak(word, { language: 'en-US', rate: 0.85 }); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Hear how to say ${word}`}
              style={[styles.hear, { backgroundColor: colors.signalSoft }]}
            >
              <Ionicons name="volume-medium" size={20} color={colors.signal} />
            </Pressable>
          </View>
        )}
        {(phase === 'meaning' || phase === 'saying') && <Text style={[styles.eyebrow, { color: colors.muted }]}>WHICH WORD MEANS THIS?</Text>}
        <Text style={[wordShown ? styles.body : styles.meaning, { color: wordShown ? colors.muted : colors.ink }]}>{info?.meaning}</Text>

        {phase === 'meaning' && missed && !failed && (
          <Text style={[styles.notice, { color: colors.ink }]}>
            {listener.transcript ? 'The phone didn’t hear the word you were looking for.' : 'The mic didn’t hear anything. Hold the phone a little closer.'} Try again, or show the word.
          </Text>
        )}
        {phase === 'saying' && !failed && <Text style={[styles.body, { color: colors.muted }]}>Say the word when it comes to you.</Text>}

        {phase === 'revealed' && (
          <Text style={[styles.body, { color: sayHeard ? colors.good : colors.muted, fontWeight: '600' }]}>
            {sayHeard ? 'The phone heard this word.' : 'Did you have it in mind? Only you can say.'}
          </Text>
        )}

        {phase === 'sentence' && (
          <Text style={[styles.body, { color: colors.ink }]}>Now say a sentence of your own with this word. It can be about anything.</Text>
        )}
        {phase === 'speaking' && !failed && <Text style={[styles.body, { color: colors.muted }]}>Say your sentence, then tap Finish.</Text>}

        {phase === 'checked' && (
          <>
            {listener.transcript.length > 0 && (
              <Text style={[styles.body, { color: colors.muted }]}>The phone heard: “{listener.transcript}”</Text>
            )}
            {check.tooShort ? (
              <Text style={[styles.notice, { color: colors.ink }]}>
                {check.spoken === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${check.spoken} ${check.spoken === 1 ? 'word' : 'words'} came through. Try a whole sentence.`}
              </Text>
            ) : check.heard ? (
              <Text style={[styles.notice, { color: colors.good }]}>The phone heard “{word}” in what you said.</Text>
            ) : overruled ? (
              <Text style={[styles.notice, { color: colors.ink }]}>You said it. The phone missed it, and that’s fine.</Text>
            ) : (
              <Text style={[styles.notice, { color: colors.ink }]}>The phone didn’t hear “{word}”. Phones miss words, so this doesn’t mean you said it wrong.</Text>
            )}
            {!check.tooShort && sentenceOk && (
              <Text style={[styles.body, { color: colors.muted }]}>Only you can say this part: was it your own sentence, not one you had seen before? We don’t check grammar.</Text>
            )}
          </>
        )}

        {failed && (
          <ListenError message={listener.error} code={listener.errorCode} onRetry={retryAfterError} />
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        {listening && !failed && (
          <View style={styles.live}>
            <View style={styles.ribbon}><VoiceRibbon level={level} color={colors.signal} height={22} /></View>
            <Pressable
              disabled={stopping}
              onPress={() => stopThen(phase === 'speaking' ? 'checked' : sayHeard ? 'revealed' : 'missed')}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.finish}
            >
              <Text style={[styles.finishText, { color: colors.ink }]}>{phase === 'speaking' ? 'Finish' : 'Stop'}</Text>
            </Pressable>
          </View>
        )}
        {phase === 'saying' && !failed && (
          <Quiet label="Show the word" disabled={stopping} onPress={() => stopThen('revealed')} />
        )}

        {phase === 'meaning' && (
          <>
            <PrimaryButton label={missed ? 'Try again' : 'Say the word'} onPress={() => listen('saying')} />
            <SecondaryButton label="Show the word" onPress={() => setPhase('revealed')} />
          </>
        )}

        {phase === 'revealed' && (
          <>
            <PrimaryButton label="I remembered" onPress={() => answer(true)} />
            <SecondaryButton label="Not yet" onPress={() => answer(false)} />
          </>
        )}

        {phase === 'sentence' && (
          <>
            <PrimaryButton label={listener.state === 'asking' ? 'Getting the mic ready…' : 'Start talking'} busy={listener.state === 'asking'} onPress={() => listen('speaking')} />
            <Quiet label="Skip this sentence" onPress={() => nextWord(tally.ownSentences)} />
          </>
        )}

        {phase === 'checked' && (
          check.tooShort ? (
            <>
              <PrimaryButton label="Try again" onPress={() => listen('speaking')} />
              <Quiet label="Skip this sentence" onPress={() => nextWord(tally.ownSentences)} />
            </>
          ) : sentenceOk ? (
            <>
              <PrimaryButton label="That was my own sentence" onPress={confirmOwnSentence} />
              <SecondaryButton label="Not really" onPress={notOwnSentence} />
            </>
          ) : (
            <>
              <PrimaryButton label="Try again" onPress={() => listen('speaking')} />
              <SecondaryButton label="I did say it" onPress={overrule} />
              <Quiet label="Skip this sentence" onPress={() => nextWord(tally.ownSentences)} />
            </>
          )
        )}

        {failed && phase === 'saying' && <Quiet label="Show the word" onPress={() => setPhase('revealed')} />}
        {failed && <Quiet label="Skip this word" onPress={() => nextWord(tally.ownSentences)} />}
      </View>
    </View>
  );
}

function Quiet({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.quietWrap}>
      <Text style={[styles.quiet, { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3) },
  message: { flex: 1, justifyContent: 'center', paddingHorizontal: space(3), gap: space(2) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 52 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  body2: { flexGrow: 1, justifyContent: 'center', gap: space(2), paddingVertical: space(3) },
  h1: { fontFamily: fonts.displayBold, fontSize: 30 },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3 },
  meaning: { fontFamily: fonts.readingBold, fontSize: 28, lineHeight: 38 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  word: { flexShrink: 1, fontFamily: fonts.readingBold, fontSize: 40, lineHeight: 50, textTransform: 'capitalize' },
  hear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 17, lineHeight: 25 },
  notice: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(2), gap: space(1.5), minHeight: 108 },
  live: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 56 },
  ribbon: { flex: 1 },
  finish: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  finishText: { fontSize: 17, fontWeight: '700' },
  quietWrap: { minHeight: 44, justifyContent: 'center' },
  quiet: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
