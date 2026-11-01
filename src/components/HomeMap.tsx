import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { aheadLabel, LESSON_KIND, lessonTitle, LINE_NAME, LineId, LINES, promptFor, sessionForStop, Stop, stopKind } from '../content/lines';
import type { SavedSession } from '../store/sessions';
import { space, useColors } from '../theme';
import { Drop, DropMood } from './Drop';

// The home map (docs/briefs/remodel-screens.md §2): one train line drawn down the screen with
// react-native-svg. Rows are laid out by React Native (so long titles wrap and push the line
// down), then each row reports where it landed and the track is drawn through the stop centres.
// The Drop stands on the current stop and hops to the next one after you finish a stop.

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICON: Record<ReturnType<typeof stopKind> | 'end', IconName> = {
  talk: 'chatbox-ellipses-outline',
  pack: 'book-outline',
  cold: 'eye-outline',
  glide: 'reorder-three-outline',
  end: 'flag-outline',
};

const SLOT = 112; // the column the stop circles sit in; their centre is SLOT / 2 from the edge
const TRACK = 10;
const DONE_R = 20;
const AHEAD_R = 22;
const CURRENT_R = 36;
const DROP_H = 84;
const DROP_W = (DROP_H * 112) / 156;
const ROW_PAD = 14; // done and ahead rows
const CURRENT_TOP = DROP_H + 6; // room for the Drop above today's stop
const CURRENT_BOTTOM = 22;
const STATION_ROW = -1;

/** Where your Drop stood last time each line was shown this launch, so it can hop on return. */
const seenIndex: Partial<Record<LineId, number>> = {};

/** The line bends between two columns every three stops, so it reads as a path, not a list. */
const sideOf = (i: number): 'L' | 'R' => (Math.floor(i / 3) % 2 === 0 ? 'L' : 'R');

type RowBox = { y: number; h: number };

export type HomeMapProps = {
  line: LineId;
  sessions: SavedSession[];
  /** First stop not done; LINES[line].length when the line is finished (the end sign). */
  currentIndex: number;
  todayDone: boolean;
  /** Whether this line shows progress colour and the Drop (your line, or one you've started). */
  active: boolean;
  dropMood: DropMood;
  /** What sits beside the current stop: the today card. */
  card: ReactNode;
  onSwitchLine: () => void;
  onOpenSession: (id: string) => void;
  /** The current stop's y inside the map, once laid out, for scrolling it into view. */
  onCurrentY?: (y: number) => void;
  now: Date;
};

export function HomeMap(props: HomeMapProps) {
  const { line, sessions, currentIndex, todayDone, active, dropMood, card, onSwitchLine, onOpenSession, onCurrentY, now } = props;
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const stops = LINES[line];
  const other: LineId = line === 'sharp' ? 'clear' : 'sharp';
  const lineColor = colors[line];
  const lineSoft = line === 'sharp' ? colors.sharpSoft : colors.clearSoft;
  const otherSoft = other === 'sharp' ? colors.sharpSoft : colors.clearSoft;

  const [width, setWidth] = useState(0);
  const [rows, setRows] = useState<Record<number, RowBox>>({});
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const measure = useCallback(
    (k: number) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      setRows((prev) => (prev[k] && prev[k].y === y && prev[k].h === height ? prev : { ...prev, [k]: { y, h: height } }));
    },
    [],
  );

  // Row k's circle centre. Rows centre their content between their own top and bottom padding.
  const padsOf = useCallback(
    (k: number) => (k === STATION_ROW ? [16, 0] : k === currentIndex ? [CURRENT_TOP, CURRENT_BOTTOM] : [ROW_PAD, ROW_PAD]),
    [currentIndex],
  );
  const centre = useCallback(
    (k: number, box: Record<number, RowBox>) => {
      const r = box[k];
      if (!r || !width) return undefined;
      if (k === STATION_ROW) return { x: SLOT / 2, y: r.y + 16 + 22 };
      const [top, bottom] = padsOf(k);
      const x = sideOf(k) === 'L' ? SLOT / 2 : width - SLOT / 2;
      return { x, y: r.y + top + (r.h - top - bottom) / 2 };
    },
    [width, padsOf],
  );

  const current = centre(currentIndex, rows);
  useEffect(() => {
    if (current && onCurrentY) onCurrentY(current.y);
  }, [current?.y, onCurrentY]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- The Drop: stands on the current stop; hops there from the last one after a finished stop.
  const move = !reduceMotion;
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(0);
  const shown = useSharedValue(0); // hidden until it has somewhere to stand
  const hopFrom = useRef<number | null>(null);

  // Runs before the placing effect below (same commit, declared first).
  useEffect(() => {
    const prev = seenIndex[line];
    seenIndex[line] = currentIndex;
    if (active && move && prev !== undefined && prev < currentIndex) hopFrom.current = prev;
  }, [line, currentIndex, active, move]);

  const dropAt = useCallback(
    (k: number, box: Record<number, RowBox>, radius: number) => {
      const c = centre(k, box);
      return c ? { x: c.x - DROP_W / 2, y: c.y - radius - DROP_H + 8 } : undefined;
    },
    [centre],
  );

  useEffect(() => {
    const to = dropAt(currentIndex, rows, CURRENT_R);
    if (!to) return;
    if (hopFrom.current === null) {
      dx.value = to.x;
      dy.value = to.y;
      shown.value = 1;
      return;
    }
    // Hold the Drop on the stop it left until the rows stop moving, then hop.
    const from = dropAt(hopFrom.current, rows, DONE_R);
    if (from) {
      dx.value = from.x;
      dy.value = from.y;
      shown.value = 1;
    }
    const timer = setTimeout(() => {
      const target = dropAt(currentIndex, rowsRef.current, CURRENT_R);
      if (!target) return;
      lift.value = withSequence(withTiming(-22, { duration: 170 }), withSpring(0, { damping: 13, stiffness: 180 }));
      dx.value = withSpring(target.x, { damping: 18, stiffness: 120 });
      dy.value = withSpring(target.y, { damping: 18, stiffness: 120 });
      hopFrom.current = null;
      // A soft tick when it lands. Haptics don't exist on web.
      if (Platform.OS !== 'web') setTimeout(() => Haptics.selectionAsync().catch(() => {}), 420);
    }, 450);
    return () => clearTimeout(timer);
  }, [rows, currentIndex, dropAt, dx, dy, lift, shown]);

  const dropStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: dx.value }, { translateY: dy.value + lift.value }],
  }));

  // ---- The track: every segment from the station through each stop to the end sign.
  const points: { k: number; c: { x: number; y: number } }[] = [];
  for (let k = STATION_ROW; k <= stops.length; k++) {
    const c = centre(k, rows);
    if (c) points.push({ k, c });
  }
  const segment = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (Math.abs(a.x - b.x) < 1) return `M${a.x},${a.y} L${b.x},${b.y}`;
    const mid = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y}`;
  };
  const solidUpTo = active ? currentIndex : STATION_ROW - 1;
  const soft: string[] = [];
  const solid: string[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].k !== points[i - 1].k + 1) continue; // a row not measured yet
    (points[i].k <= solidUpTo ? solid : soft).push(segment(points[i - 1].c, points[i].c));
  }
  const station = centre(STATION_ROW, rows);
  // A soft band of the line colour behind today's stop and its card (drawn under the track).
  const bandRow = rows[Math.min(currentIndex, stops.length)];
  const BAND_INSET_TOP = CURRENT_TOP - space(3);
  const mapHeight = Object.values(rows).reduce((m, r) => Math.max(m, r.y + r.h), 0);

  const doneLabel = (stop: Stop, i: number): [string, string] => {
    const s = sessionForStop(stop.id, sessions);
    const topic = stop.lesson ? lessonTitle(stop.lesson) : promptFor(stop)?.text ?? '';
    const kind = i === 0 ? 'Your first talk' : LESSON_KIND[stopKind(stop)];
    const flow = typeof s?.flow === 'number' ? `Flow ${s.flow}` : 'Done';
    return [`${kind} · ${topic.replace(/[.?]$/, '')}`, i === 0 && s?.flow !== undefined ? `${flow} · your starting point` : flow];
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ minHeight: mapHeight }}>
      {/* The track, behind everything. Ahead is the soft tint; done is the line colour. */}
      {width > 0 && mapHeight > 0 && (
        <Svg width={width} height={mapHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          {bandRow && (
            <Rect x={space(1)} y={bandRow.y + BAND_INSET_TOP} width={width - space(2)} height={bandRow.h - BAND_INSET_TOP - space(1)} rx={28} fill={lineSoft} />
          )}
          {station && (
            <Path
              d={`M${station.x},${station.y} C${station.x + 60},${station.y + 18} ${width - 120},${station.y + 4} ${width + 12},${station.y + 8}`}
              stroke={otherSoft}
              strokeWidth={TRACK}
              fill="none"
              strokeLinecap="round"
            />
          )}
          {soft.map((d, i) => (
            <Path key={`s${i}`} d={d} stroke={lineSoft} strokeWidth={TRACK} fill="none" strokeLinecap="round" />
          ))}
          {solid.map((d, i) => (
            <Path key={`d${i}`} d={d} stroke={lineColor} strokeWidth={TRACK} fill="none" strokeLinecap="round" />
          ))}
        </Svg>
      )}

      {/* The station both lines leave from, and the other line's tag. */}
      <View onLayout={measure(STATION_ROW)} style={styles.stationRow}>
        <View style={[styles.station, { backgroundColor: colors.surface, borderColor: colors.ink }]}>
          <Text style={[styles.stationText, { color: colors.ink }]}>Start</Text>
        </View>
        <Pressable
          onPress={onSwitchLine}
          accessibilityRole="button"
          accessibilityLabel={`Show ${LINE_NAME[other]}`}
          style={({ pressed }) => [styles.otherTag, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={[styles.dot, { backgroundColor: colors[other] }]} />
          <Text style={[styles.otherText, { color: colors.ink }]}>{LINE_NAME[other]}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>

      {stops.map((stop, i) => {
        const side = sideOf(i);
        const icon = ICON[stopKind(stop)];
        if (i === currentIndex) {
          return (
            <CurrentRow key={stop.id} side={side} onLayout={measure(i)} ring={lineColor} icon={icon} label={`Stop ${i + 1}`}>
              {card}
            </CurrentRow>
          );
        }
        const isDone = i < currentIndex || !!sessionForStop(stop.id, sessions);
        if (isDone && active) {
          const [title, sub] = doneLabel(stop, i);
          const s = sessionForStop(stop.id, sessions);
          return (
            <Pressable
              key={stop.id}
              onLayout={measure(i)}
              onPress={s ? () => onOpenSession(s.id) : undefined}
              disabled={!s}
              accessibilityRole={s ? 'button' : 'text'}
              accessibilityLabel={`Stop ${i + 1}, ${title}, done, ${sub}`}
              style={[styles.row, side === 'R' && styles.rowR]}
            >
              <View style={styles.slot}>
                <View style={[styles.doneNode, { backgroundColor: lineColor }]}>
                  <Ionicons name="checkmark" size={24} color={colors.onLine} />
                </View>
              </View>
              <View style={[styles.label, side === 'R' && styles.labelR]}>
                <Text style={[styles.labelTitle, { color: colors.ink }, side === 'R' && styles.textR]} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={[styles.labelSub, { color: colors.muted }, side === 'R' && styles.textR]}>{sub}</Text>
              </View>
            </Pressable>
          );
        }
        // Ahead: one a day from the current stop (tomorrow's, if today's is done).
        const daysAhead = i - currentIndex + (todayDone ? 1 : 0);
        const when = aheadLabel(daysAhead, i + 1, now);
        return (
          <View
            key={stop.id}
            onLayout={measure(i)}
            accessible
            accessibilityLabel={`Stop ${i + 1}, ${LESSON_KIND[stopKind(stop)]}, ${when}`}
            style={[styles.row, side === 'R' && styles.rowR]}
          >
            <View style={styles.slot}>
              <View style={[styles.aheadNode, { backgroundColor: colors.surface, borderColor: lineSoft }]}>
                <Ionicons name={icon} size={20} color={colors.muted} />
              </View>
            </View>
            <View style={[styles.label, side === 'R' && styles.labelR]}>
              <Text style={[styles.labelTitle, { color: colors.muted }, side === 'R' && styles.textR]}>{LESSON_KIND[stopKind(stop)]}</Text>
              <Text style={[styles.labelSub, { color: colors.muted }, side === 'R' && styles.textR]}>{when}</Text>
            </View>
          </View>
        );
      })}

      {/* The end of the content we have. Topic talks keep coming daily after it. */}
      {currentIndex >= stops.length ? (
        <CurrentRow side={sideOf(stops.length)} onLayout={measure(stops.length)} ring={lineColor} icon={ICON.end} label="End of the line so far">
          {card}
        </CurrentRow>
      ) : (
        <View onLayout={measure(stops.length)} accessible accessibilityLabel="More stops soon" style={[styles.row, sideOf(stops.length) === 'R' && styles.rowR, { paddingBottom: space(4) }]}>
          <View style={styles.slot}>
            <View style={[styles.aheadNode, { backgroundColor: colors.surface, borderColor: lineSoft }]}>
              <Ionicons name={ICON.end} size={20} color={colors.muted} />
            </View>
          </View>
          <View style={[styles.label, sideOf(stops.length) === 'R' && styles.labelR]}>
            <Text style={[styles.labelTitle, { color: colors.muted }, sideOf(stops.length) === 'R' && styles.textR]}>More stops soon</Text>
            <Text style={[styles.labelSub, { color: colors.muted }, sideOf(stops.length) === 'R' && styles.textR]}>A new topic every day until then</Text>
          </View>
        </View>
      )}

      {active && (
        <Animated.View pointerEvents="none" style={[styles.drop, dropStyle]}>
          <Drop height={DROP_H} mood={dropMood} />
        </Animated.View>
      )}
    </View>
  );
}

/** Today's stop: a big ring on a soft band of the line colour, with the card beside it. */
function CurrentRow({
  side,
  onLayout,
  ring,
  icon,
  label,
  children,
}: {
  side: 'L' | 'R';
  onLayout: (e: LayoutChangeEvent) => void;
  ring: string;
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View onLayout={onLayout} style={[styles.row, side === 'R' && styles.rowR, { paddingTop: CURRENT_TOP, paddingBottom: CURRENT_BOTTOM }]}>
      <View style={styles.slot} accessible accessibilityLabel={label}>
        <View style={[styles.currentNode, { backgroundColor: colors.surface, borderColor: ring }]}>
          <Ionicons name={icon} size={30} color={ring} />
        </View>
      </View>
      <View style={[styles.cardWrap, side === 'R' ? { paddingLeft: space(2) } : { paddingRight: space(2) }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stationRow: { paddingTop: 16, height: 128 },
  station: { position: 'absolute', top: 16, left: SLOT / 2 - 48, width: 96, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  stationText: { fontSize: 17, fontWeight: '800' },
  otherTag: {
    position: 'absolute',
    right: space(2),
    top: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 44,
  },
  otherText: { fontSize: 16, fontWeight: '600' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: ROW_PAD, minHeight: 72 },
  rowR: { flexDirection: 'row-reverse' },
  slot: { width: SLOT, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, minWidth: 0, paddingRight: space(2.5), gap: 2 },
  labelR: { paddingRight: 0, paddingLeft: space(2.5), alignItems: 'flex-end' },
  textR: { textAlign: 'right' },
  labelTitle: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  labelSub: { fontSize: 15, lineHeight: 20 },
  doneNode: { width: DONE_R * 2, height: DONE_R * 2, borderRadius: DONE_R, alignItems: 'center', justifyContent: 'center' },
  aheadNode: { width: AHEAD_R * 2, height: AHEAD_R * 2, borderRadius: AHEAD_R, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  currentNode: { width: CURRENT_R * 2, height: CURRENT_R * 2, borderRadius: CURRENT_R, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  cardWrap: { flex: 1, minWidth: 0 },
  drop: { position: 'absolute', left: 0, top: 0 },
});
