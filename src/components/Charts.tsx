import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

// SVG text doesn't inherit the app font; on web it would fall back to a serif.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../theme';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

const H = 170;
const PAD = { l: 34, r: 12, t: 12, b: 22 };

function niceMax(v: number, step: number) {
  return Math.max(step, Math.ceil(v / step) * step);
}

/** Pace by session with the 130–165 target zone shaded. Latest point emphasised. */
export function PaceChart({
  values,
  band,
  width,
  colors,
}: {
  values: number[];
  band: [number, number];
  width: number;
  colors: Colors;
}) {
  const min = Math.min(100, ...values) - 10;
  const max = niceMax(Math.max(band[1] + 20, ...values), 20);
  const lo = Math.floor(min / 20) * 20;
  const x = (i: number) => PAD.l + (values.length < 2 ? 0 : (i / (values.length - 1)) * (width - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (max - lo)) * (H - PAD.t - PAD.b);
  const ticks = [lo, Math.round((lo + max) / 2 / 10) * 10, max];
  const last = values.length - 1;

  // The line draws itself left to right, ending on today's point.
  let length = 0;
  for (let i = 1; i < values.length; i++) length += Math.hypot(x(i) - x(i - 1), y(values[i]) - y(values[i - 1]));
  length = Math.ceil(length) + 1;
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.value = 0;
    drawn.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [values.join(','), drawn]); // eslint-disable-line react-hooks/exhaustive-deps
  const drawProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));

  return (
    <View accessibilityLabel={`Pace over your last ${values.length} sessions, latest ${values[last]} words per minute`}>
      <Svg width={width} height={H}>
        <Rect x={PAD.l} width={width - PAD.l - PAD.r} y={y(band[1])} height={y(band[0]) - y(band[1])} fill={colors.good} opacity={0.14} />
        {ticks.map((t) => (
          <Line key={t} x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText fontFamily={FONT} key={`l${t}`} x={PAD.l - 6} y={y(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
            {t}
          </SvgText>
        ))}
        <AnimatedPolyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={colors.signal}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={drawProps}
        />
        {values.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 5 : 3} fill={colors.signal} />
        ))}
        <SvgText fontFamily={FONT} x={x(last)} y={y(values[last]) - 10} fontSize={12} fontWeight="700" fill={colors.ink} textAnchor="end">
          {values[last]}
        </SvgText>
        <SvgText fontFamily={FONT} x={PAD.l} y={H - 4} fontSize={11} fill={colors.muted}>
          oldest
        </SvgText>
        <SvgText fontFamily={FONT} x={width - PAD.r} y={H - 4} fontSize={11} fill={colors.muted} textAnchor="end">
          latest
        </SvgText>
      </Svg>
    </View>
  );
}

/** Fillers per minute by session. Lower is better; the latest bar is the accent. */
export function FillerBars({ values, width, colors }: { values: number[]; width: number; colors: Colors }) {
  const max = niceMax(Math.max(2, ...values), 2);
  const innerW = width - PAD.l - PAD.r;
  const bw = innerW / Math.max(values.length, 1);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const ticks = [0, max / 2, max];

  return (
    <View accessibilityLabel={`Fillers per minute over your last ${values.length} sessions`}>
      <Svg width={width} height={H}>
        {ticks.map((t) => (
          <Line key={t} x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText fontFamily={FONT} key={`l${t}`} x={PAD.l - 6} y={y(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
            {+t.toFixed(1)}
          </SvgText>
        ))}
        {values.map((v, i) => (
          <Rect
            key={i}
            x={PAD.l + i * bw + bw * 0.2}
            width={bw * 0.6}
            y={y(v)}
            height={Math.max(1, y(0) - y(v))}
            rx={3}
            fill={i === values.length - 1 ? colors.signal : colors.unread}
          />
        ))}
        <SvgText fontFamily={FONT} x={PAD.l} y={H - 4} fontSize={11} fill={colors.muted}>
          oldest
        </SvgText>
        <SvgText fontFamily={FONT} x={width - PAD.r} y={H - 4} fontSize={11} fill={colors.muted} textAnchor="end">
          latest
        </SvgText>
      </Svg>
    </View>
  );
}

/** 12 weeks × 7 days of practice, Monday at the top. */
export function HeatStrip({ grid, width, colors }: { grid: number[][]; width: number; colors: Colors }) {
  const gap = 4;
  const cell = Math.min(18, (width - gap * (grid.length - 1)) / grid.length);
  return (
    <Svg width={width} height={cell * 7 + gap * 6} accessibilityLabel="Practice days over the last 12 weeks">
      {grid.map((week, w) =>
        week.map((n, d) =>
          n < 0 ? null : (
            <Rect
              key={`${w}-${d}`}
              x={w * (cell + gap)}
              y={d * (cell + gap)}
              width={cell}
              height={cell}
              rx={4}
              fill={n > 0 ? colors.signal : colors.line}
              opacity={n > 1 ? 1 : n === 1 ? 0.7 : 1}
            />
          ),
        ),
      )}
    </Svg>
  );
}
