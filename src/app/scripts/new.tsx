import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chunkScript, MAX_SCRIPT_WORDS, saveScript, titleFrom, wordCount } from '../../content/scripts';
import { PrimaryButton } from '../../components/ui';
import { getMoment } from '../../content/moments';
import { useProfile } from '../../store/profile';
import { markStep } from '../../plan';
import { track } from '../../analytics';
import { space, useColors } from '../../theme';

export default function NewScript() {
  const { moment: momentId, step } = useLocalSearchParams<{ moment?: string; step?: string }>();
  const moment = getMoment(momentId);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [title, setTitle] = useState(moment ? `My ${moment.short}` : '');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const words = wordCount(text);
  const parts = words ? chunkScript(text).length : 0;
  const tooLong = words > MAX_SCRIPT_WORDS;
  const tooShort = words > 0 && words < 20;

  const save = async () => {
    setSaving(true);
    const s = await saveScript(title, text);
    track('script_saved', { words: wordCount(text), parts: s.chunks.length, moment: moment?.id ?? null });
    if (moment) {
      await markStep(profile, update, step, { scriptId: s.id });
      router.back(); // straight back to the plan; the next step is rehearsing it
    } else router.replace({ pathname: '/scripts/[id]', params: { id: s.id } });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.bg, paddingTop: space(2), paddingBottom: insets.bottom + space(2) }]}
    >
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>{moment ? `Your ${moment.short}` : 'New script'}</Text>
        <View style={{ width: 56 }} />
      </View>
      {moment && (
        <Text style={[styles.meta, { color: colors.ink, fontSize: 16 }]}>
          {moment.scriptPrompt} Use your own words: this is what you’ll rehearse.
        </Text>
      )}

      <TextInput
        id="script-title"
        value={title}
        onChangeText={setTitle}
        placeholder={text ? titleFrom(text) : 'Title (optional)'}
        placeholderTextColor={colors.unread}
        style={[styles.titleInput, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
        returnKeyType="next"
      />
      <TextInput
        id="script-text"
        value={text}
        onChangeText={setText}
        placeholder={moment?.scriptPlaceholder ?? 'Paste or type what you need to say…'}
        placeholderTextColor={colors.unread}
        multiline
        textAlignVertical="top"
        style={[styles.body, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.meta, { color: tooLong ? colors.stumble : colors.muted }]}>
        {tooLong
          ? `${words} words. The limit is ${MAX_SCRIPT_WORDS}; split it into two scripts.`
          : tooShort
            ? 'Add a little more: at least 20 words.'
            : words
              ? `${words} words · ${parts} ${parts === 1 ? 'part' : 'parts'} of about a minute each`
              : `Up to ${MAX_SCRIPT_WORDS} words.`}
      </Text>
      <PrimaryButton label="Save and rehearse" disabled={!words || tooLong || tooShort} busy={saving} onPress={save} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(2.5), gap: space(1.5) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  cancel: { fontSize: 17 },
  title: { fontSize: 17, fontWeight: '700' },
  titleInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: space(2), paddingVertical: 14, fontSize: 17 },
  body: { flex: 1, borderWidth: 1, borderRadius: 14, padding: space(2), fontSize: 17, lineHeight: 24 },
  meta: { fontSize: 14 },
});
