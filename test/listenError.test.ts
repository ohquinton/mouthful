// The "stopped listening" card: its title comes from the error code alone (never from matching
// the message), and every code that may come back offers Carry on + Start over.
import { errorCard, errorTitle } from '../src/components/listenErrorCard';
import type { ListenerErrorCode } from '../src/speech/useListener';

describe('errorTitle', () => {
  it.each<[ListenerErrorCode | null, string]>([
    ['language-not-supported', 'Can’t listen for this English'],
    ['interrupted', 'Paused'],
    ['network', 'Lost the connection'],
    ['repeated-failure', 'The phone isn’t hearing you'],
    ['restart-failed', 'The phone stopped listening'],
    [null, 'The phone stopped listening'],
  ])('%s → %s', (code, title) => {
    expect(errorTitle(code)).toBe(title);
  });

  it('ignores the message: a body mentioning the network does not change the title', () => {
    const card = errorCard('repeated-failure', 'Check your network connection', true);
    expect(card.title).toBe('The phone isn’t hearing you');
  });
});

describe('errorCard buttons', () => {
  it.each<ListenerErrorCode>(['interrupted', 'network', 'repeated-failure', 'restart-failed'])(
    '%s offers Carry on and Start over when the screen can resume',
    (code) => {
      const card = errorCard(code, 'Some message. Tap Carry on.', true);
      expect(card.primary).toBe('resume');
      expect(card.startOver).toBe(true);
      expect(card.chooseEnglish).toBe(false);
    },
  );

  it('language-not-supported never offers Carry on, and points to another English', () => {
    const card = errorCard('language-not-supported', 'This phone can’t listen for Indian English.', true);
    expect(card.primary).toBe('retry');
    expect(card.startOver).toBe(false);
    expect(card.chooseEnglish).toBe(true);
    expect(card.body).toBe('This phone can’t listen for Indian English.');
  });

  it('falls back to Try again only when the screen has no Carry on', () => {
    const card = errorCard('network', 'msg', false);
    expect(card.primary).toBe('retry');
    expect(card.startOver).toBe(false);
  });
});

describe('errorCard body', () => {
  it('interrupted says the mic was taken and where the reader got to, not that it was a call', () => {
    const card = errorCard('interrupted', 'Listening stopped when something else used the mic. Try again.', true, 'budget');
    expect(card.body).toBe('Something else used the mic, so listening stopped. You got to “budget”.');
    expect(card.body).not.toMatch(/call/i);
    expect(card.label).toBe('Paused. Something else used the mic, so listening stopped. You got to “budget”. Carry on, or start over.');
  });

  it('other resumable codes use the listener message, plus where the reader got to', () => {
    const msg = 'The speech service couldn’t be reached. When you’re back online, tap Carry on.';
    expect(errorCard('network', msg, true, 'quarter').body).toBe(`${msg} You got to “quarter”.`);
    expect(errorCard('network', msg, true).body).toBe(msg);
  });

  it('has a body even when the message is missing', () => {
    expect(errorCard('restart-failed', null, true).body).toBe('The phone stopped listening.');
    expect(errorCard(null, null, false).body).toBe('Something went wrong with speech recognition.');
  });
});
