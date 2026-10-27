import { memo, useEffect, useRef } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WordStatus } from '../engine/align';
import { Colors, fonts } from '../theme';

export type WordBox = { x: number; y: number; w: number; h: number };

type Props = {
  index: number;
  display: string;
  status: WordStatus;
  corrected: boolean;
  isPacer: boolean;
  breath: 'none' | 'open' | 'filled';
  colors: Colors;
  onMeasure: (index: number, box: Partial<WordBox>) => void;
  onCorrect: (index: number) => void;
};

/**
 * One word of the passage. Inks in over 120ms when read; nothing bounces or scales.
 * A red (skipped) word can be tapped to say "I did say that" — the recogniser is
 * sometimes wrong, and the app shouldn't argue with the reader.
 */
function GlideWordBase({ index, display, status, corrected, isPacer, breath, colors, onMeasure, onCorrect }: Props) {
  const ink = useRef(new Animated.Value(status === 'pending' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(ink, { toValue: status === 'pending' ? 0 : 1, duration: 120, useNativeDriver: false }).start();
  }, [status, ink]);

  const red = status === 'skipped' && !corrected;
  const color = ink.interpolate({ inputRange: [0, 1], outputRange: [colors.unread, red ? colors.stumble : colors.ink] });

  const word = (
    <View style={styles.pill} onLayout={(e: LayoutChangeEvent) => onMeasure(index, { w: e.nativeEvent.layout.width })}>
      <Animated.Text
        style={[
          styles.word,
          { color },
          red && { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.stumble },
        ]}
      >
        {display}
      </Animated.Text>
      {isPacer && <View style={[styles.pacer, { backgroundColor: colors.signal }]} />}
    </View>
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => {
        const { x, y, height } = e.nativeEvent.layout;
        onMeasure(index, { x, y, h: height });
      }}
    >
      {red ? (
        <Pressable onPress={() => onCorrect(index)} accessibilityRole="button" accessibilityLabel={`${display}, marked as skipped. Tap if you said it.`} hitSlop={4}>
          {word}
        </Pressable>
      ) : (
        word
      )}
      {breath !== 'none' && <Text style={[styles.breath, { color: breath === 'filled' ? colors.signal : colors.line }]}>/</Text>}
    </View>
  );
}

export const GlideWord = memo(GlideWordBase);

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', marginRight: 4 },
  pill: { borderRadius: 6, paddingHorizontal: 2 },
  word: { fontFamily: fonts.reading, fontSize: 25, lineHeight: 40, letterSpacing: -0.2 },
  breath: { fontFamily: fonts.reading, fontSize: 20, lineHeight: 38, marginLeft: 1 },
  pacer: { position: 'absolute', left: 2, right: 2, bottom: 4, height: 3, borderRadius: 2, opacity: 0.3 },
});
