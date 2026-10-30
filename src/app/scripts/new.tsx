import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chunkScript, loadScripts, MAX_SCRIPT_WORDS, saveScript, Script, titleFrom, wordCount } from '../../content/scripts';
import { PrimaryButton, ProBadge, Row } from '../../components/ui';
import { getMoment } from '../../content/moments';
import { useProfile } from '../../store/profile';
import { markStep } from '../../plan';
import { requirePro, scriptStepOptions } from '../../pro';
import { track } from '../../analytics';
import { space, useColors } from '../../theme';

export default function NewScript() {
  const { moment: momentId, step } = useLocalSearchParams<{ moment?: string; step?: string }>();
  const moment = getMoment(momentId);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update, ready } = useProfile();
  const [title, setTitle] = useState(moment ? `My ${moment.short}` : '');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  // Scripts already saved: from a moment's step 3 they can be used for the moment (pro.ts scriptStepOptions).
  const [saved, setSaved] = useState<Script[]>();
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let live = true;
    loadScripts().then((all) => live && setSaved(all));
    return () => {
      live = false;
    };
  }, []);

  const options = scriptStepOptions({ pro: profile.pro, scriptCount: saved?.length ?? 0 });
  // Linking a saved script is only for a moment's plan; the Scripts tab lists them already.
  const canPick = !!moment && options.pick;
  // A free reader with their one script saved can only pick, so the list is all there is.
  const showPicker = canPick && (picking || !options.add);

  // Second line of defence for deep links: the buttons that open this screen already check.
  // A free reader's first script is free; with one saved and nothing to pick it for, swap this
  // screen for the soft wall.
  useEffect(() => {
    if (!ready || !saved || options.add || canPick) return;
    router.replace({ pathname: '/paywall', params: { feature: 'scripts' } });
  }, [ready, saved, options.add, canPick]);

  const words = wordCount(text);
  const parts = words ? chunkScript(text).length : 0;
  const tooLong = words > MAX_SCRIPT_WORDS;
  const tooShort = words > 0 && words < 20;

  const save = async () => {
    setSaving(true);
    const s = await saveScript(title, text);
    track('script_saved', { words: wordCount(text), parts: s.chunks.length, moment: moment?.id ?? null, free: !profile.pro });
    if (moment) {
      await markStep(profile, update, step, { scriptId: s.id });
      router.back(); // straight back to the plan; the next step is rehearsing it
    } else router.replace({ pathname: '/scripts/[id]', params: { id: s.id } });
  };

  /** Use a saved script for this moment: no new script, so nothing to pay for. */
  const link = async (s: Script) => {
    setSaving(true);
    // This screen is step 3 whenever it has a moment, so a deep link without `step` still links.
    await markStep(profile, update, step ?? 'script', { scriptId: s.id });
    track('script_linked', { parts: s.chunks.length, moment: moment?.id ?? null, free: !profile.pro });
    router.back();
  };

  if (!saved) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const top = (
    <View style={styles.top}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.ink }]}>{moment ? `Your ${moment.short}` : 'New script'}</Text>
      <View style={{ width: 56 }} />
    </View>
  );

  if (showPicker && moment) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: space(2), paddingBottom: insets.bottom + space(2) }]}>
        {top}
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.h2, { color: colors.ink }]}>Use a script you’ve saved</Text>
          <Text style={[styles.meta, { color: colors.muted, fontSize: 16 }]}>
            Pick the one for your {moment.short}. It becomes this plan’s script.
          </Text>
          {saved.map((s) => {
            const n = s.chunks.reduce((sum, c) => sum + wordCount(c), 0);
            return (
              <Row
                key={s.id}
                title={s.title}
                meta={`${n} ${n === 1 ? 'word' : 'words'} · ${s.chunks.length} ${s.chunks.length === 1 ? 'part' : 'parts'}`}
                onPress={() => !saving && link(s)}
              />
            );
          })}
        </ScrollView>
        {options.add ? (
          <Pressable onPress={() => setPicking(false)} hitSlop={8} accessibilityRole="button" style={styles.alt}>
            <Text style={[styles.altText, { color: colors.ink }]}>Write a new one instead</Text>
          </Pressable>
        ) : (
          // A second new script is Pro: this opens the scripts soft wall.
          <Pressable onPress={() => requirePro(profile, 'scripts')} hitSlop={8} accessibilityRole="button" style={[styles.alt, styles.altRow]}>
            <Text style={[styles.altText, { color: colors.ink }]}>Add a new script</Text>
            <ProBadge />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.bg, paddingTop: space(2), paddingBottom: insets.bottom + space(2) }]}
    >
      {top}
      {moment && (
        <Text style={[styles.meta, { color: colors.ink, fontSize: 16 }]}>
          {moment.scriptPrompt} Use your own words: this is what you’ll rehearse.
        </Text>
      )}
      {canPick && (
        <Pressable onPress={() => setPicking(true)} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.altText, { color: colors.signal }]}>Use a script you’ve saved</Text>
        </Pressable>
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
      {/* iOS's Live Text reads printed notes through the camera, straight into the box. Android has no equivalent here. */}
      {Platform.OS === 'ios' && (
        <Text style={[styles.meta, { color: colors.muted }]}>Tip: on iPhone, tap the box, then Scan Text to copy from paper.</Text>
      )}

      <Text style={[styles.meta, { color: tooLong ? colors.stumble : colors.muted }]}>
        {tooLong
          ? `${words} words. The limit is ${MAX_SCRIPT_WORDS}; split it into two scripts.`
          : tooShort
            ? 'Add a little more: at least 20 words.'
            : words
              ? `${words} words · ${parts} ${parts === 1 ? 'part' : 'parts'} of about a minute each`
              : `Up to ${MAX_SCRIPT_WORDS} words.`}
      </Text>
      <PrimaryButton label="Save and rehearse" disabled={!words || tooLong || tooShort || !options.add} busy={saving} onPress={save} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(2.5), gap: space(1.5) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  cancel: { fontSize: 17 },
  title: { fontSize: 17, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '700' },
  list: { gap: space(1.5), paddingBottom: space(2) },
  titleInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: space(2), paddingVertical: 14, fontSize: 17 },
  body: { flex: 1, borderWidth: 1, borderRadius: 14, padding: space(2), fontSize: 17, lineHeight: 24 },
  meta: { fontSize: 14 },
  alt: { alignSelf: 'center', paddingVertical: space(1.25), minHeight: 44, justifyContent: 'center' },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  altText: { fontSize: 16, fontWeight: '600' },
});
