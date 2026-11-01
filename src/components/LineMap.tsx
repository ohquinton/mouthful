import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts, useColors } from '../theme';
import type { PracticeLine } from '../content/journey';
import { Drop } from './Drop';

type Props = {
  line: PracticeLine;
  topic: string;
  tomorrow: string;
  done: boolean;
  previous?: { title: string; flow?: number };
  active?: boolean;
};

/** The track is decorative; the stations remain readable, ordered text at any font size. */
export function LineMap({ line, topic, tomorrow, done, previous, active = true }: Props) {
  const colors = useColors();
  const color = colors[line];
  const soft = line === 'sharp' ? colors.sharpSoft : colors.clearSoft;
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(300);
  const travel = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    travel.set(reduceMotion || !active ? (done ? 1 : 0) : withTiming(done ? 1 : 0, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(travel);
  }, [done, reduceMotion, active, travel]);
  const rider = useAnimatedStyle(() => {
    const t = travel.value;
    const x = (width - 64) * (3 * t * t - 2 * t * t * t);
    const y = 162 * t * (1 - t) * (1 - t) + 48 * t * t * (1 - t) + 102 * t * t * t;
    return { transform: [{ translateX: x }, { translateY: y }] };
  });
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.startRow} accessible>
        <View style={[styles.startStation, { borderColor: color, backgroundColor: colors.surface }]}>
          <Ionicons name={previous ? 'checkmark' : 'git-branch-outline'} size={18} color={color} />
        </View>
        <View style={styles.label}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{previous ? 'LAST STOP · DONE' : 'YOUR STARTING POINT'}</Text>
          <Text style={[styles.smallTitle, { color: colors.ink }]}>{previous ? previous.title : 'One minute. Your own words.'}</Text>
        </View>
      </View>
      <View style={[styles.stem, { backgroundColor: color }]} />
      <View style={[styles.currentRow, fontScale > 1.3 && styles.stacked]} accessible>
        <View style={[styles.currentTrack, { backgroundColor: color }]} />
        <View style={[styles.currentStation, { borderColor: color, backgroundColor: done ? color : colors.surface }]}>
          <Ionicons name={done ? 'checkmark' : 'chatbubble-ellipses-outline'} size={24} color={done ? colors.onLine : color} />
        </View>
        <View style={[styles.todayCard, fontScale > 1.3 && { width: '100%' }, { backgroundColor: colors.surface, borderColor: soft }]}>
          <Text style={[styles.eyebrow, { color }]}>{done ? 'TODAY · COMPLETE' : 'TODAY’S TOPIC'}</Text>
          <Text style={[styles.topic, { color: colors.ink }]}>{topic}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{done ? 'A minute for yourself. Well spent.' : 'A minute to think, speak, and find your words.'}</Text>
        </View>
      </View>
      <View style={styles.bridge} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={width} height={102}>
          <Path d={`M32 0C32 54 ${width - 32} 16 ${width - 32} 102`} stroke={soft} strokeWidth={8} fill="none" />
          <Path d={`M32 0C32 54 ${width - 32} 16 ${width - 32} 102`} stroke={color} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 10" fill="none" />
        </Svg>
        <Animated.View style={[styles.rider, rider]}><Drop size={64} mood={done ? 'happy' : 'rest'} animated={active} /></Animated.View>
      </View>
      <View style={styles.nextRow} accessible>
        <View style={[styles.label, { alignItems: 'flex-end' }]}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>TOMORROW</Text>
          <Text style={[styles.nextTitle, { color: colors.muted }]}>{tomorrow}</Text>
        </View>
        <View style={[styles.nextStation, { borderColor: soft, backgroundColor: colors.bg }]}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.muted} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 },
  startStation: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, marginHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  smallTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  stem: { marginLeft: 28, width: 8, height: 34 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  currentTrack: { position: 'absolute', left: 28, top: 0, bottom: 0, width: 8 },
  currentStation: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  todayCard: { flex: 1, minWidth: 0, padding: 18, gap: 8, borderWidth: 1.5, borderRadius: 22 },
  topic: { fontFamily: fonts.readingBold, fontSize: 25, lineHeight: 34 },
  body: { fontSize: 14, lineHeight: 21 },
  bridge: { height: 70, marginTop: 12 },
  rider: { position: 'absolute', left: 0, top: -52 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64 },
  nextStation: { width: 36, height: 36, borderWidth: 3, borderRadius: 18, marginHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontFamily: fonts.reading, fontSize: 17, lineHeight: 25, textAlign: 'right' },
});
