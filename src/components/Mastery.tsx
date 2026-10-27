import { View } from 'react-native';
import { LEARNED_AFTER_DAYS } from '../engine/vocab';
import { Colors } from '../theme';

/** Three dots: one per clean day. All three filled = learned. */
export function Mastery({ days, colors }: { days: number; colors: Colors }) {
  const done = days >= LEARNED_AFTER_DAYS;
  return (
    <View
      style={{ flexDirection: 'row', gap: 4 }}
      accessibilityLabel={done ? 'Learned' : `${days} of ${LEARNED_AFTER_DAYS} clean days`}
    >
      {Array.from({ length: LEARNED_AFTER_DAYS }, (_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i < days ? (done ? colors.good : colors.signal) : colors.line,
          }}
        />
      ))}
    </View>
  );
}
