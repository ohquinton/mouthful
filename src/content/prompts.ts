export const PROMPTS = [
  'Explain what you do for work to a ten-year-old.',
  'Pitch your favourite restaurant in sixty seconds.',
  'What’s one opinion you hold that most people disagree with?',
  'Describe the best meal you’ve ever had.',
  'Teach me something you learned this week.',
  'What would you do with an extra hour every day?',
  'Give a thirty-second update on a project you’re working on.',
  'Tell me about a time a plan went wrong, and what you did.',
  'Introduce yourself as if you’re starting a new job on Monday.',
  'Convince me to visit the city you live in.',
  'Explain a hobby of yours to someone who has never tried it.',
  'What advice would you give yourself five years ago?',
];

export function promptOfTheDay(date = new Date(), offset = 0): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PROMPTS[(day + offset) % PROMPTS.length];
}
