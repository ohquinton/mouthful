import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PackWord } from '../content/wordpacks';
import { space, useColors } from '../theme';

/** Self-guided only: no listener, persistence, assessment or completion reward. Key by word. */
export function WordReflection({ word }: { word: PackWord }) {
  const colors = useColors();
  const [refining, setRefining] = useState(false);
  const [example, setExample] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>In your own words</Text>
      <Text style={[styles.prompt, { color: colors.ink }]}>{word.practice}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>Take a moment, then speak out loud. This practice isn’t recorded or scored.</Text>
      {word.refinement && (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: refining }} onPress={() => setRefining(!refining)} style={styles.action}>
            <Text style={[styles.label, { color: colors.signal }]}>{refining ? 'Hide refinement' : 'Refine your thought'}</Text>
          </Pressable>
          {refining && <Text style={[styles.prompt, { color: colors.ink }]}>{word.refinement}</Text>}
        </>
      )}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: example }} onPress={() => setExample(!example)} style={styles.action}>
        <Text style={[styles.label, { color: colors.signal }]}>{example ? 'Hide example' : 'See an example'}</Text>
      </Pressable>
      {example && <Text style={[styles.prompt, { color: colors.muted }]}>“{word.example}”</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: space(1), maxWidth: 520 },
  label: { fontSize: 15, fontWeight: '600' },
  prompt: { fontSize: 17, lineHeight: 26 },
  note: { fontSize: 14, lineHeight: 21 },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: space(2) },
});
