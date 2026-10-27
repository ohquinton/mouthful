import { useColorScheme } from 'react-native';

// "Ink and air": the passage is the hero, everything else gets out of the way.
const light = {
  bg: '#F3F4F7', // chalk
  surface: '#FFFFFF',
  ink: '#14161F',
  muted: '#5D6272',
  unread: '#A5AAB8',
  line: '#DDE0E8',
  signal: '#2F49F5', // cobalt accent
  button: '#2F49F5', // filled buttons with white text
  signalSoft: '#E4E8FF',
  good: '#12936B',
  ember: '#C27A00',
  stumble: '#D23B3B',
  card: '#14161F', // the dark hero card
  cardInk: '#F3F4F7',
  cardMuted: '#9298AA',
};

const dark: typeof light = {
  bg: '#0E1017',
  surface: '#171A24',
  ink: '#ECEEF5',
  muted: '#9298AA',
  unread: '#5A6072',
  line: '#2A2E3C',
  signal: '#7B8CFF',
  button: '#3D52F0', // darker than signal so white text stays readable
  signalSoft: '#232A55',
  good: '#3CC79A',
  ember: '#E3A33A',
  stumble: '#FF6B6B',
  card: '#1E2230',
  cardInk: '#ECEEF5',
  cardMuted: '#9298AA',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

// Serif for the passage only. UI text uses the system font (SF Pro on iOS).
export const fonts = {
  reading: 'Literata_500Medium',
  readingBold: 'Literata_700Bold',
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  ui: undefined as string | undefined, // system
  mono: 'Menlo',
};

export const space = (n: number) => n * 8;
