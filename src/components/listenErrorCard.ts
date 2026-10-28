import type { ListenerErrorCode } from '../speech/useListener';
import { canResumeAfter } from '../speech/gate';

/**
 * What the "stopped listening" card says and which buttons it shows, from the listener's
 * error code alone. Pure, so it's unit tested (test/listenError.test.ts) without React Native.
 * ListenError.tsx renders it.
 */

/** The card's title for each way the recogniser can stop. Codes only: the message is the body. */
export function errorTitle(code: ListenerErrorCode | null): string {
  switch (code) {
    case 'language-not-supported':
      return 'Can’t listen for this English';
    case 'interrupted':
      return 'Paused';
    case 'network':
      return 'Lost the connection';
    case 'repeated-failure':
      return 'The phone isn’t hearing you';
    default:
      // 'restart-failed', or no code at all (shouldn't happen: the listener always sets one).
      return 'The phone stopped listening';
  }
}

export type ErrorCard = {
  title: string;
  body: string;
  /** The filled button: Carry on (keeps the read) or Try again (a fresh attempt). */
  primary: 'resume' | 'retry';
  /** "Start over" link next to Carry on. */
  startOver: boolean;
  /** "Choose another English" link, to the You tab. */
  chooseEnglish: boolean;
  /** VoiceOver reads this instead of title + body, when set. */
  label?: string;
};

/**
 * @param hasResume the screen passed onResume (it can carry on). Without it every code gets Try again.
 * @param lastWord the last word Glide reached, for "You got to …". Glide only.
 */
export function errorCard(code: ListenerErrorCode | null, message: string | null, hasResume: boolean, lastWord?: string): ErrorCard {
  const title = errorTitle(code);
  // The listener's own rule (gate.ts), so the card can't offer Carry on where resume() would do nothing.
  const resume = hasResume && canResumeAfter(code);
  const gotTo = lastWord ? ` You got to “${lastWord}”.` : '';

  if (!resume) {
    return {
      title,
      // The listener's interrupted message says "Try again", which is right when there's no Carry on.
      body: message || 'Something went wrong with speech recognition.',
      primary: 'retry',
      startOver: false,
      chooseEnglish: code === 'language-not-supported',
    };
  }

  // We don't say it was a call, because we don't know. The other codes' messages already
  // end with "tap Carry on" (useListener.ts).
  const body =
    code === 'interrupted'
      ? `Something else used the mic, so listening stopped.${gotTo}`
      : `${message || 'The phone stopped listening.'}${gotTo}`;
  return {
    title,
    body,
    primary: 'resume',
    startOver: true,
    chooseEnglish: false,
    // The body already says "tap Carry on" except for interrupted.
    label: `${title}. ${body} ${code === 'interrupted' ? 'Carry on, or start over.' : 'Or start over.'}`,
  };
}
