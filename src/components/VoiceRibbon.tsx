import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// A thin waveform that answers your actual voice: still when you're quiet,
// moving when the mic hears you. Lives in the footer, never over the text.

const WEIGHTS = [0.35, 0.55, 0.8, 1, 0.7, 0.9, 0.6, 1, 0.75, 0.5, 0.85, 0.4];

/** Returns the shared level and a setter to pass as the listener's onLevel. */
export function useVoiceLevel() {
  const level = useSharedValue(0);
  const onLevel = useCallback(
    (l: number) => {
      // Smooth and clamp so it breathes instead of jittering.
      level.set(withTiming(Math.min(1, l * 1.4), { duration: 140, easing: Easing.out(Easing.quad) }));
    },
    [level],
  );
  return { level, onLevel };
}

function Bar({ i, level, color, height }: { i: number; level: SharedValue<number>; color: string; height: number }) {
  const style = useAnimatedStyle(() => ({
    height: 2 + level.value * WEIGHTS[i] * (height - 2),
  }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function VoiceRibbon({ level, color, height = 18 }: { level: SharedValue<number>; color: string; height?: number }) {
  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {WEIGHTS.map((_, i) => (
        <Bar key={i} i={i} level={level} color={color} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 3, borderRadius: 2 },
});
