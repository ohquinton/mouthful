# Outside-world research (2026-11-01)

> From the research scout (sonnet). Saved as sections arrive. Unverified claims are marked.

## 3. Speech tech (partial)
- **Apple SpeechAnalyzer (iOS 26+):** free, on-device, word-level timing; an RN wrapper `@react-native-ai/apple` (https://www.callstack.com/blog/on-device-speech-transcription-with-apple-speechanalyzer). A third-party benchmark claims 2.12% WER vs 3.74% for Whisper Small (UNVERIFIED, https://rohitraj.tech/en/notes/apple-speechanalyzer-vs-whisper-on-device-stt-2026). Needs iOS 26; the wrapper may not expose word timings.
- **whisper.rn:** whisper.cpp for RN, Core ML on iOS; MIT (unverified); word timestamps not confirmed (https://www.sourcepulse.org/projects/1856658).
- **Moonshine `@siteed/moonshine.rn`:** word timestamps, native rebuild, v0.4: young and risky (https://cdn.jsdelivr.net/npm/@siteed/moonshine.rn@0.4.0/README.md).
- **Fillers:** speech models often drop um/uh, which is our known weak point. PodcastFillers has 35k labelled fillers (licence unverified, https://arxiv.org/abs/2203.15135); SEP-28k-E is CC BY-NC, so no commercial use.
- **First step:** on a phone, compare SpeechAnalyzer vs whisper.rn on 20 recordings with fillers and count how many ums each keeps.

## 4. Indie founder evidence (partial)
- RevenueCat data (via secondary blog, https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026): hard paywall D35 download-to-paid 12.1% vs freemium 2.2%; year-1 LTV per payer $49.30 vs $24.24; refunds 5.8% vs 3.4%. RevenueCat 2026: ~10.7% vs 2.1% (https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026).
- 82% of trials start on day 0 (secondary): onboarding and paywall placement matter most.
- Longer trials (17–32 days) 45.7% vs 26.8% for 3–7 days (secondary, unverified).
- Implication: our "first rated talk before the paywall" is a bet against data that favours hard paywalls: test it, don't assume it.

## 1. Niches (thin; ranking is a judgement call, willingness to pay UNVERIFIED)
- Toastmasters: ~345–357k members in 140+ countries, gathered in clubs and on Meetup; 74.9% of surveyed members report less speaking fear (https://content.toastmasters.org/image/upload/Fact-Sheet-Infographic-202507.pdf). Reachable and already motivated.
- Ranking: (1) ESL professionals preparing for interviews (urgent, on Reddit/LinkedIn, already pay tutors); (2) Toastmasters and debaters; (3) new managers and sales reps (can pay, but a B2B sale); (4) streamers and podcasters. Never frame anything as stutter therapy.

## 2. Viral mechanics
- Wordle's share grid (Dec 2021) showed the pattern without spoiling the answer, so it could be posted publicly; no link in the share text (https://www.kevin-indig.com/wordles-growth-loop).
- Duolingo: the streak (with streak-saver notifications) is the main retention lever; a 2021 TikTok month drew 73M views over 25 videos (secondary).
- BeReal: fast growth that faded (DAU figures conflict): a cautionary tale.
- **For us:** a spoiler-free share card, the shared topic of the day + your Flow + a pattern of your minute, without the words. Almost free to build.

## 5. Ideas borrowed from other apps (from the scout's own knowledge, no sources)
1. Wordle: one shared daily topic + an emoji grid of your minute (one cell per 10 s, by fillers and pace).
2. Duolingo: streak freeze + the Drop reacting after each talk.
3. Strava: weekly personal-best segments (longest fluent run).
4. Apple Fitness: three rings (talked, a no-filler stretch, a new word used).
5. Spotify Wrapped: a yearly recap of words you stopped overusing.
6. Peloton: live "same topic, same hour" sessions.
7. Anki: a topic you fumbled comes back in 3 days.
8. Guitar Hero: stay inside the pace band like a note track.
9. Chess puzzles: a difficulty ladder for topics.
10. Headspace: a short warm-up before the talk.

## Top 10 (ranked by the scout)
1. Spoiler-free share card: shared daily topic + an emoji grid of your minute, no link in the share text (near zero cost).
2. First rated result before the paywall, A/B tested against a hard paywall in RevenueCat (data favours hard paywalls).
3. Apple SpeechAnalyzer (iOS 26+) for on-device transcription; spike it against whisper.rn on 20 filler-heavy clips.
4. Streak + streak-saver notifications (Duolingo's main lever).
5. First paid niche: ESL job-seekers, then Toastmasters (~350k); post free help in 5 subreddits and Toastmasters groups.
6. Mascot-led TikTok: 3 short clips a week of the Drop reacting to real talks.
7. Personal bests and a yearly recap (Strava / Wrapped style).
8. Filler detection from audio, not transcripts: check the PodcastFillers licence.
9. Moonshine (young wrapper): later.
10. Live same-topic sessions (Peloton style): once there's an audience.

**Not covered (search budget ran out):** ASO, review prompts, TikTok-to-install funnels, willingness to pay per niche.
