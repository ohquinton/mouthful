import { changeBetween, EMPTY_CHECK, focusFor, measureAttempt, nextPointTask, partsSaid, POINT_TASKS, pointTaskById, type PointAttempt } from '../src/exercises/makeYourPoint';
import { sanitise } from '../src/analytics';
import { nextAfterTalk } from '../src/store/minute';

const attempt = (over: Partial<PointAttempt> = {}): PointAttempt => ({ words: 30, seconds: 20, firstWordSeconds: 3, um: 0, check: { ...EMPTY_CHECK }, hinted: false, ...over });
const all = { point: true, reason: true, example: true };

describe('Make your point', () => {
  it('has unique ids and plain questions', () => {
    expect(new Set(POINT_TASKS.map((t) => t.id)).size).toBe(POINT_TASKS.length);
    expect(POINT_TASKS.every((t) => t.question.endsWith('?'))).toBe(true);
  });

  it('measures words, time to first word and length from the first word', () => {
    const m = measureAttempt('my point is um that it helps people', 1000, 4000, 14000);
    expect(m).toMatchObject({ firstWordSeconds: 3, seconds: 10, um: 1 });
    expect(m.words).toBeGreaterThanOrEqual(7);
  });

  it('never goes negative when nothing was heard', () => {
    expect(measureAttempt('', 1000, 0, 6000)).toEqual({ words: 0, seconds: 0, firstWordSeconds: 5, um: 0 });
  });

  it('focuses on the first missing part, in order', () => {
    expect(focusFor(EMPTY_CHECK)).toMatch(/point/);
    expect(focusFor({ ...EMPTY_CHECK, point: true })).toMatch(/why/);
    expect(focusFor({ point: true, reason: true, example: false })).toMatch(/example/);
    expect(focusFor(all)).toMatch(/without the prompts/);
  });

  it('names what changed and never calls the answer better', () => {
    const lines = [
      changeBetween(attempt(), attempt({ check: { ...EMPTY_CHECK, point: true } })),
      changeBetween(attempt({ check: all }), attempt({ check: all })),
      changeBetween(attempt({ check: all }), attempt({ check: { ...EMPTY_CHECK, point: true } })),
      changeBetween(attempt({ firstWordSeconds: 8 }), attempt({ firstWordSeconds: 3 })),
      changeBetween(attempt(), attempt()),
    ];
    expect(lines[0]).toContain('1 of the 3 parts');
    expect(lines[1]).toContain('without the prompts');
    expect(lines[2]).toContain('down from 3');
    expect(lines[3]).toContain('5 seconds sooner');
    for (const l of lines) expect(l).not.toMatch(/better|great|score|correct/i);
  });

  it('does not claim "without the prompts" if the reader opened them', () => {
    const line = changeBetween(attempt({ check: all }), attempt({ check: all, hinted: true }));
    expect(line).toBe('You included all three parts both times.');
  });

  it('counts parts', () => expect(partsSaid({ point: true, reason: false, example: true })).toBe(2));

  it('picks the least recently practised question and never repeats the current one', () => {
    expect(nextPointTask([]).id).toBe('mp01');
    expect(nextPointTask([], 'mp01').id).toBe('mp02');
    const history = POINT_TASKS.map((t, i) => ({ taskId: t.id, at: i + 1 }));
    expect(nextPointTask(history).id).toBe('mp01');
    expect(nextPointTask(history, 'mp01').id).toBe('mp02');
  });

  it('ignores an unknown route id', () => expect(pointTaskById('nope')).toBeUndefined());

  it('sends codes and numbers to analytics, never a question', () => {
    const out = sanitise({ kind: 'point', which: 'mp01', parts_second: 3, question: POINT_TASKS[0].question });
    expect(out).toEqual({ kind: 'point', which: 'mp01', parts_second: 3 });
  });
});

describe('nextAfterTalk', () => {
  const talk = (over: object) => ({ minute: { talkSeconds: 60, longPauses: 0, repeated: [], ...over } }) as never;

  it('goes again on the same topic when there is something to act on', () => {
    expect(nextAfterTalk(talk({ longPauses: 3 })).action).toBe('again');
    const r = nextAfterTalk(talk({ repeated: [{ word: 'really', count: 7 }] }));
    expect(r.action).toBe('again');
    expect(r.detail).toContain('really');
  });

  it('moves on to structure after a smooth talk', () => {
    expect(nextAfterTalk(talk({})).action).toBe('point');
  });
});
