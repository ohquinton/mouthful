import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useProfile } from '../../store/profile';
import { clearSessionRecordings, clearSessionReviews, loadSessions, recordingUris, reviewCount } from '../../store/sessions';
import { deleteAllRecordings, listRecordings } from '../../store/recordings';
import { analyticsEnabled, track } from '../../analytics';
import { countdownLabel, getMoment } from '../../content/moments';
import { listenLocale, onDeviceSupported, serverServiceName } from '../../speech/useListener';
import { SPEECH_LOCALES } from '../../engine/locale';
import { BRAND } from '../../brand';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cancelDailyReminder, formatTime, REMINDER_OPTIONS, scheduleDailyReminder } from '../../reminders';
import { restore, PurchasesNotConfigured } from '../../purchases';
import { PrimaryButton, SectionTitle } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

export default function You() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update, reset } = useProfile();
  const [note, setNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [confirmRecDelete, setConfirmRecDelete] = useState(false);
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);
  // After tester mode is switched off: how many sessions still hold what the phone heard.
  const [reviewsLeft, setReviewsLeft] = useState(0);
  // Tester mode is hidden: tap the version line 7 times, or build with EXPO_PUBLIC_TESTER_MODE=1.
  const [versionTaps, setVersionTaps] = useState(0);
  const showTester = profile.testerMode === true || versionTaps >= 7 || process.env.EXPO_PUBLIC_TESTER_MODE === '1';

  const countRecordings = useCallback(() => {
    loadSessions()
      .then((all) => {
        let files = 0;
        try {
          files = listRecordings().length;
        } catch {}
        setRecCount(Math.max(files, all.filter((x) => (x.recordings ?? []).length > 0).length));
      })
      .catch(() => {});
  }, []);
  useFocusEffect(countRecordings);

  const deleteRecordings = async () => {
    const n = deleteAllRecordings(recordingUris(await loadSessions()));
    await clearSessionRecordings();
    setConfirmRecDelete(false);
    setRecCount(0);
    setNote(n === 1 ? 'Deleted 1 recording.' : `Deleted ${n} recordings.`);
    track('recordings_deleted', { count: n });
  };

  const withdrawServer = async () => {
    await update({ allowServerRecognition: false });
    track('server_recognition_consent', { allowed: false, where: 'you' });
    setPrivacyNote(`Turned off. Next time this phone can’t listen offline, ${BRAND.name} will ask first.`);
  };

  const setTesterMode = async (on: boolean) => {
    await update({ testerMode: on });
    if (on) {
      setReviewsLeft(0);
      return;
    }
    // Tester mode kept what the phone heard for each read. Offer to delete it now rather than
    // leave a tester's words on the phone without anyone remembering they're there.
    setReviewsLeft(reviewCount(await loadSessions()));
  };

  const deleteReviews = async () => {
    const n = await clearSessionReviews();
    setReviewsLeft(0);
    setNote(n === 1 ? 'Deleted what the phone heard in 1 session.' : `Deleted what the phone heard in ${n} sessions.`);
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(BRAND.privacyUrl).catch(() => setPrivacyNote(`Couldn’t open the link. It’s ${BRAND.privacyUrl}`));
  };

  const setReminder = async (opt: { hour: number; minute: number } | null) => {
    if (!opt) {
      await cancelDailyReminder();
      await update({ reminder: null });
      setNote('Reminder off.');
      return;
    }
    const ok = await scheduleDailyReminder(opt.hour, opt.minute);
    if (ok) {
      await update({ reminder: opt });
      setNote(`Reminder set for ${formatTime(opt.hour, opt.minute)}.`);
    } else setNote(`Notifications are off for ${BRAND.name}. Turn them on in Settings to get a reminder.`);
  };

  const onRestore = async () => {
    try {
      const r = await restore();
      if (r.pro) await update({ pro: true });
      setNote(r.pro ? 'Pro restored.' : 'No earlier purchase found for this account.');
    } catch (e) {
      setNote(e instanceof PurchasesNotConfigured ? e.message : 'Couldn’t reach the store. Check your connection and try again.');
    }
  };

  const moment = getMoment(profile.moment?.id);
  const lang = listenLocale(profile.speechLang);
  const onDevice = onDeviceSupported(lang);

  const chip = (selected: boolean) => [
    styles.chip,
    { borderColor: selected ? colors.signal : colors.line, backgroundColor: selected ? colors.signalSoft : colors.surface },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(5) }]}
    >
      <Text style={[styles.h1, { color: colors.ink }]}>You</Text>

      <View style={[styles.plan, { backgroundColor: profile.pro ? colors.signalSoft : colors.card }]}>
        <Text style={[styles.planTitle, { color: profile.pro ? colors.ink : colors.cardInk }]}>
          {profile.pro ? `${BRAND.name} Pro` : 'Free plan'}
        </Text>
        <Text style={[styles.planSub, { color: profile.pro ? colors.muted : colors.cardMuted }]}>
          {profile.pro
            ? 'Everything is unlocked. Thanks for backing a small app.'
            : 'Plans for your big moments, Glide, the free Word Pack and streaks. Pro adds your own scripts, word drills, every pack and your full history.'}
        </Text>
        {!profile.pro && <PrimaryButton label="See Pro" onPress={() => router.push('/paywall')} style={{ marginTop: space(1) }} />}
      </View>

      <SectionTitle>What you’re preparing for</SectionTitle>
      <Pressable
        onPress={() => router.push('/moment')}
        style={({ pressed }) => [styles.momentRow, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.momentTitle, { color: colors.ink }]}>{moment ? moment.title : 'Everyday speaking'}</Text>
          <Text style={[styles.momentSub, { color: colors.muted }]}>
            {moment ? countdownLabel(moment, profile.moment?.date) : 'No big moment coming up'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <SectionTitle>Daily reminder</SectionTitle>
      <View style={styles.chips}>
        {REMINDER_OPTIONS.map((o) => {
          const on = profile.reminder?.hour === o.hour && profile.reminder?.minute === o.minute;
          return (
            <Pressable key={`${o.hour}:${o.minute}`} style={chip(on)} onPress={() => setReminder(o)}>
              <Text style={[styles.chipText, { color: colors.ink }]}>{formatTime(o.hour, o.minute)}</Text>
            </Pressable>
          );
        })}
        <Pressable style={chip(!profile.reminder)} onPress={() => setReminder(null)}>
          <Text style={[styles.chipText, { color: colors.ink }]}>Off</Text>
        </Pressable>
      </View>

      {note && <Text style={[styles.note, { color: colors.muted }]}>{note}</Text>}

      <SectionTitle>English the phone listens for</SectionTitle>
      <Text style={[styles.body, { color: colors.muted }]}>
        Pick the one closest to how you speak. Speech recognition hears words more clearly when it expects your kind of English.
      </Text>
      <View style={styles.chips}>
        {SPEECH_LOCALES.map((l) => {
          const on = l.id === lang;
          return (
            <Pressable
              key={l.id}
              style={chip(on)}
              onPress={() => update({ speechLang: l.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, { color: colors.ink }]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Privacy</SectionTitle>
      {/* Short lines, one idea each: what's heard, where it goes, where it's kept. */}
      <View style={styles.lines}>
        <Text style={[styles.body, { color: colors.muted }]}>{BRAND.name} listens only while you practise.</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {onDevice
            ? 'This phone turns your voice into text by itself. Nothing is sent anywhere.'
            : profile.allowServerRecognition
              ? `To follow your reading, this phone sends your voice to ${serverServiceName()} while you practise.`
              : 'This phone can’t do this by itself for your English. We’ll ask before sending your voice anywhere.'}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Your sessions, scripts and recordings stay on this phone (and its backup, if you use one). We never receive them.
        </Text>
      </View>
      {profile.allowServerRecognition === true && (
        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.momentTitle, { color: colors.ink }]}>Use {serverServiceName()}</Text>
            <Text style={[styles.momentSub, { color: colors.muted }]}>
              Turn off to stop sending your voice there. We’ll ask before the next session that needs it.
            </Text>
          </View>
          <Switch value onValueChange={(v) => {
              if (!v) withdrawServer();
            }} accessibilityLabel={`Use ${serverServiceName()}`} />
        </View>
      )}
      {analyticsEnabled && (
        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.momentTitle, { color: colors.ink }]}>Share anonymous usage counts</Text>
            <Text style={[styles.momentSub, { color: colors.muted }]}>
              Counts like “session finished” help us improve the app. Never your words or voice.
            </Text>
          </View>
          <Switch
            value={profile.analyticsOptOut !== true}
            onValueChange={(v) => update({ analyticsOptOut: !v })}
            accessibilityLabel="Share anonymous usage counts"
          />
        </View>
      )}
      {privacyNote && <Text style={[styles.note, { color: colors.muted }]}>{privacyNote}</Text>}
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.momentTitle, { color: colors.ink }]}>Keep Day 1 and re-test recordings</Text>
          <Text style={[styles.momentSub, { color: colors.muted }]}>
            For before-and-after replay. Kept on this phone, and in its backup if you use one.
          </Text>
        </View>
        <Switch value={profile.keepRecordings === true} onValueChange={(v) => update({ keepRecordings: v })} accessibilityLabel="Keep Day 1 and re-test recordings" />
      </View>
      {profile.keepRecordings !== true && recCount > 0 && (
        <Text style={[styles.body, { color: colors.muted }]}>
          New sessions won’t be recorded. Recordings you already have stay on this phone until you delete them.
        </Text>
      )}
      {recCount > 0 &&
        (confirmRecDelete ? (
          <View style={styles.confirm}>
            <Text style={[styles.body, { color: colors.ink }]}>Delete all your recordings? Your scores and sessions stay.</Text>
            <View style={styles.confirmRow}>
              <Pressable onPress={deleteRecordings} hitSlop={8}>
                <Text style={[styles.link, { color: colors.stumble }]}>Delete recordings</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmRecDelete(false)} hitSlop={8}>
                <Text style={[styles.link, { color: colors.muted }]}>Keep them</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmRecDelete(true)} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.signal }]}>
              Delete recordings ({recCount})
            </Text>
          </Pressable>
        ))}

      <View style={styles.links}>
        <Pressable onPress={openPrivacyPolicy} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.signal }]}>Privacy policy</Text>
        </Pressable>
        <Pressable onPress={onRestore} hitSlop={8}>
          <Text style={[styles.link, { color: colors.signal }]}>Restore purchases</Text>
        </Pressable>
        {confirmReset ? (
          <View style={styles.confirm}>
            <Text style={[styles.body, { color: colors.ink }]}>Delete every session, script, recording and setting?</Text>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={async () => {
                  await cancelDailyReminder();
                  await reset();
                  router.replace('/onboarding');
                }}
                hitSlop={8}
              >
                <Text style={[styles.link, { color: colors.stumble }]}>Delete everything</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmReset(false)} hitSlop={8}>
                <Text style={[styles.link, { color: colors.muted }]}>Keep it</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmReset(true)} hitSlop={8}>
            <Text style={[styles.link, { color: colors.muted }]}>Reset all data</Text>
          </Pressable>
        )}
      </View>

      {showTester && (
        <>
          <SectionTitle>Tester mode</SectionTitle>
          <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.momentTitle, { color: colors.ink }]}>Record every reading session</Text>
              <Text style={[styles.momentSub, { color: colors.muted }]}>
                For supervised beta tests, with the tester’s OK. Keeps the audio and what the phone heard on this phone (and in its
                backup, if one is on) so you can check them side by side. Copy the numbers, then delete recordings or reset before the next tester.
              </Text>
            </View>
            <Switch
              value={profile.testerMode === true}
              onValueChange={setTesterMode}
              accessibilityLabel="Tester mode: record every reading session"
            />
          </View>
          {profile.testerMode && (
            <Pressable onPress={() => router.push('/review')} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.signal }]}>Review sessions</Text>
            </Pressable>
          )}
        </>
      )}
      {reviewsLeft > 0 && (
        <View style={styles.confirm}>
          <Text style={[styles.body, { color: colors.ink }]}>
            Tester mode is off. {reviewsLeft === 1 ? '1 session still keeps' : `${reviewsLeft} sessions still keep`} what the phone heard.
          </Text>
          <Text style={[styles.body, { color: colors.ink }]}>Delete that now? Scores stay. Recordings are under Privacy.</Text>
          <View style={styles.confirmRow}>
            <Pressable onPress={deleteReviews} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.stumble }]}>Delete it</Text>
            </Pressable>
            <Pressable onPress={() => setReviewsLeft(0)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.muted }]}>Keep for now</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={() => setVersionTaps((n) => n + 1)} accessibilityRole="text">
        <Text style={[styles.version, { color: colors.muted }]}>{BRAND.name} {Constants.expoConfig?.version ?? ''}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  plan: { borderRadius: 20, padding: space(2.5), gap: space(1) },
  planTitle: { fontSize: 20, fontWeight: '700' },
  planSub: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.75), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '500' },
  note: { fontSize: 14 },
  body: { fontSize: 15, lineHeight: 21 },
  links: { gap: space(2), marginTop: space(1) },
  link: { fontSize: 16, fontWeight: '600' },
  confirm: { gap: space(1) },
  lines: { gap: space(0.75) },
  confirmRow: { flexDirection: 'row', gap: space(3) },
  version: { fontSize: 13, marginTop: space(2) },
  momentRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: space(2), minHeight: 64 },
  momentTitle: { fontSize: 16, fontWeight: '600' },
  momentSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
});
