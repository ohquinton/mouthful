# Animation, characters and assets (design-ux, 2026-10-30)

## Runtime

- **Now: Reanimated 4.7.1 + react-native-svg 15.16** (installed; no rebuild). Covers every micro-interaction below.
- **Mascot later: Rive** (`@rive-app/react-native`, MIT, Nitro runtime; needs `react-native-nitro-modules` pinned to
  0.36.x (peer range >=0.35.10 <0.37) and a dev-client rebuild). State machines let the character idle, listen and
  settle from our code; files are tens of KB. Guide: https://rive.app/docs/runtimes/react-native/adding-rive-to-expo.md
- Lottie only for one-shot stock clips (no state machine). Skip Skia (overkill) and Moti (stale wrapper).

## Assets and licences

| Source | Licence | Attribution |
|---|---|---|
| Phosphor (`phosphor-react-native`, JS only) | MIT | No (best icon fit) |
| Lucide | ISC | No |
| Open Peeps | CC0 | No |
| unDraw | free commercial (no packs, no competing service, no AI training) | No |
| Blush | free commercial (no resale/redistribution) | No |
| Humaaans | sources disagree | Check first |
| Storyset free | free with credit | **Yes** |
| IconScout free | per asset | Check each |
| LottieFiles | Lottie Simple License | Optional |
| Rive Community / Marketplace | CC BY 4.0 | **Yes** |
| Noto Animated Emoji | CC BY 4.0 | **Yes** |

Any CC BY asset needs a credits row in You → About and a line in the store listing. Recommendation: Phosphor icons
plus one character of our own in Rive, not stock packs.

## Mascot (sketches in docs/design/mascot/)

**Decided 2026-10-30: the Drop is the mascot** (pilot on onboarding + empty states first). One quiet character, Headspace-style: shape and eyes, no mouth that could frown, no age, skin or gender. Reacts
by settling, never sadness. Concepts: **Drop** (ink drop that fills your words; design-ux's pick), Bubble (reads
as a chatbot), Pebble (breathes; strong for the One Minute ring and the Paused card).

- Appears: onboarding hook (listening pose on the mic step), empty states, Tape ("steadier than last time" only
  vs your own history, never about accuracy or score), heat-strip "day done", One Minute countdown, Paused card,
  small on the paywall header.
- Never: Glide (principle 6), the too-short card, Fix-it, or next to any number it could seem to grade.
- Colour (decided 2026-10-30): no new token and no glow effects. Celebrations use the existing `good`
  colour, quietly; amber means "watch out" only. The Drop is flat, two colours, no shine (the sketch's highlight
  dot goes). See "Taste" in .claude/agents/04-design-ux.md.

## Animation moments (outside Glide; all respect Reduce Motion)

1. Reduce Motion support for the existing count-up, onboarding and chart draw-in (`useReducedMotion`). S, first.
2. Tape word chips ink in one by one (40 ms apart, once). S.
3. "You finished": the dark card's underline draws in 400 ms with the success haptic. No confetti. S.
4. One Minute ring timer (SVG stroke on the UI thread; light haptic at 10 s left). M.
5. Heat strip: today's cell fills when a plan step is done. S.
6. Mic step: the voice ribbon previews your level before Day 1. S.
7. Mascot pilot in Rive: onboarding + empty states only, then measure. L, rebuild.
8. Paused card: slow 4 s breathing scale. S.
