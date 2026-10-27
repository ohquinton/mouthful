import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import { track } from '../analytics';
import { space, useColors } from '../theme';

/**
 * Plays a session's recording (one or more files, back to back).
 * Hearing yourself on Day 1 next to today is more convincing than any score.
 */
export function ReplayButton({ uris, label, sub, accent }: { uris: string[]; label: string; sub: string; accent?: boolean }) {
  const colors = useColors();
  const player = useAudioPlayer(uris[0] ?? null);
  const status = useAudioPlayerStatus(player);
  const part = useRef(0);
  const [active, setActive] = useState(false);

  // Move on to the next file when one finishes (iOS can split long recordings).
  useEffect(() => {
    if (!active || !status.didJustFinish) return;
    part.current++;
    if (part.current < uris.length) {
      player.replace(uris[part.current]);
      player.play();
    } else {
      part.current = 0;
      player.replace(uris[0]);
      setActive(false);
    }
  }, [status.didJustFinish, active, uris, player]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      setActive(false);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    setActive(true);
    player.play();
    track('recording_played', { which: accent ? 'latest' : 'day1' });
  };

  const playing = status.playing;
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${label}`}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: accent ? colors.signalSoft : colors.surface, borderColor: accent ? colors.signal : colors.line, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: accent ? colors.button : colors.ink }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={accent ? '#fff' : colors.bg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.25), borderWidth: 1, borderRadius: 16, padding: space(1.5), minHeight: 64 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
});
