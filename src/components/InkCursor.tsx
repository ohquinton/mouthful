import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { WordBox } from './GlideWord';

// Living ink: one soft cobalt highlight that travels to the next word like a finger
// under the line, instead of a highlight popping on and off each word.

const MOVE = { duration: 170, easing: Easing.out(Easing.cubic) };

export function InkCursor({ box, color, visible }: { box: WordBox | undefined; color: string; visible: boolean }) {
  const x = useSharedValue(box?.x ?? 0);
  const y = useSharedValue(box?.y ?? 0);
  const w = useSharedValue(box?.w ?? 0);
  const h = useSharedValue(box?.h ?? 0);
  const o = useSharedValue(0);

  useEffect(() => {
    if (!box) return;
    // Jump (don't slide) on the first placement and across lines, so it never sweeps diagonally over text.
    // get()/set() instead of .value: same behaviour, and the React Compiler lint can follow it.
    const sameLine = Math.abs(box.y - y.get()) < 4 && o.get() > 0;
    x.set(sameLine ? withTiming(box.x, MOVE) : box.x);
    y.set(box.y);
    w.set(sameLine ? withTiming(box.w, MOVE) : box.w);
    h.set(box.h);
  }, [box, x, y, w, h, o]);

  useEffect(() => {
    o.set(withTiming(visible && box ? 1 : 0, { duration: 200 }));
  }, [visible, box, o]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: w.value,
    height: h.value,
    opacity: o.value,
  }));

  return <Animated.View pointerEvents="none" style={[styles.cursor, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  cursor: { position: 'absolute', left: 0, top: 0, borderRadius: 7 },
});
