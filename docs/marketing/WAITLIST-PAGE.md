# Waitlist landing page (draft, 2026-11-01)

> From marketing-lead. The TikTok/Reddit/Telegram bio link needs this before day 1. Nothing is live yet.

## Status of the current site
`ohquinton/mouthful-site` (Jekyll: `_config.yml`, `index.md`, `privacy.md`) is stale: it says "Mouthful", "Make it yours", and leads with interviews, presentations and raises. `ohquinton.github.io/mouthful-site/` redirects to `quintonjackson.ca/mouthful-site/`, which returned **404** on 2026-11-01. So there is no working landing page. The privacy URL in `src/brand.ts` (GitHub file view) works.

## Hosting ($0)
Keep GitHub Pages: replace `index.md` with the page below, set `_config.yml` title to SaidClearly, add a "Waitlist" section to `privacy.md`, then fix the custom-domain 404 (repo Settings → Pages, and the quintonjackson.ca DNS/CNAME). Waitlist form: a free **Tally** form embedded on the page, with hidden fields reading `?utm_source=…&utm_content=…` so each account's sign-ups are counted with no analytics script. Fallback: Google Form. Later, maybe rename the repo to `saidclearly-site` (GitHub redirects; update the privacy link in brand.ts).

## Main page (Sharp Talk / general)
**Sound sharp. Say what you mean.**
SaidClearly gives you one topic a day. Talk for a minute, see your ums, repeated words and pace, and try to beat yesterday. Coming to iPhone.

1. **One minute a day.** A new topic, a Flow rating for whether you kept talking, and the details: ums the phone heard, the word you leaned on, how fast you started, your pace.
2. **Two lines.** Sharp Talk for precise words and fewer fillers, Clear English for being understood the first time. A new stop each day: a topic talk, a word pack or a read-aloud rehearsal.
3. **Private by design.** No account. Recordings are off unless you turn them on.

Privacy line (word for word, matches docs/privacy.md): It listens only while you talk. When your phone can turn speech into text by itself, your voice stays on the phone. When it can't, SaidClearly asks first.

[email] **Get early access**
We'll email you when the beta opens and when it's in the App Store. Nothing else. Unsubscribe any time.
(Canada's CASL: express consent, sender, unsubscribe. Email footer: "Sent by Quinton Jackson, [city], Canada". Privacy page "Waitlist" section: we keep your email only to tell you about SaidClearly, stored with [form tool], deleted on request.)

### FAQ
1. **Is it out yet?** Not yet. It's in testing on iPhone. Join the list and we'll email you when the beta opens and when it's in the App Store.
2. **Does it grade my accent or pronunciation?** No. Flow is whether you kept talking. The app shows what your phone heard and counts what it can count: ums, repeated words, pauses, pace. It never scores how you sound.
3. **Is it an AI coach?** No. Your phone turns your speech into text, and SaidClearly counts and times it. It doesn't write answers for you or judge your ideas.
4. **Does my voice leave my phone?** Only if your phone can't turn speech into text by itself, and only after you say yes. Then it goes to your phone's own speech service (Apple on iPhone). Recordings are off unless you turn them on, and stay on the phone.
5. **What will it cost?** Free to start. Pro will be a subscription; you'll see the price before you pay, and we'll tell the list first. [confirm]

## Clear English variant (`?line=clear` or `/clear`)
**Be understood the first time.**
Talk about an everyday topic for one minute a day. Learn useful words and say them in sentences. Plain English, no accent score.
1. One everyday topic a day: rain, the bus, coffee. One minute, out loud.
2. "Say this, not that" word packs, and a read-aloud where you see which words your phone heard clearly.
3. No account. It listens only while you talk.
Same form ("Get early access"); FAQ 1, 2 and 4. Never: "lose your accent", "sound native", "fix your English", "perfect pronunciation".

Sources: https://github.com/ohquinton/mouthful-site · https://tally.so/help/faq · https://tally.so/help/tally-a-free-typeform-alternative · https://splitforms.com/reviews/tally
