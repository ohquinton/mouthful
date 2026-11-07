import AsyncStorage from '@react-native-async-storage/async-storage';
import { SITUATIONS, situationById } from '../src/content/situations';
import {
  clearTooShort, finishCheck, heardLine, MIN_RESPONSE_WORDS, nextSituation, openStarters, readyToRespond, responseHeard, retry,
  situationCompleteProps, situationFeedback, situationRecord, startFlow, toggleTick, type SituationRecord,
} from '../src/content/situationFlow';
import { loadSituationRecords, MAX_RECORDS, pauseSituationWrites, saveSituationRecord } from '../src/store/situations';
import { wipeAllData } from '../src/store/resetData';
import { sanitise } from '../src/analytics';

jest.mock('../src/store/recordings', () => ({ deleteAllRecordings: jest.fn(() => 0) }));

const first = SITUATIONS[0];
const atCheck = () => responseHeard(responseHeard(readyToRespond(startFlow()), 5), 8);
const rec = (situationId: string, at = 1): SituationRecord => ({ situationId, at, attempt: 1, startersOpened: false, supportedWords: 5, independentWords: 8, ticks: [], checks: 2 });

describe('situation content', () => {
  it('keeps the six ids exactly, in order: analytics and saved results rely on them', () => {
    expect(SITUATIONS.map((s) => s.id)).toEqual(['meet_new', 'ask_help', 'explain_problem', 'arrange_plans', 'clarify', 'late']);
  });

  it('gives every situation a task, three examples, a line to answer, starters and checks', () => {
    for (const s of SITUATIONS) {
      expect(s.task.match(/[.?!]/g)).toHaveLength(1); // one sentence
      expect(s.examples).toHaveLength(3);
      expect(s.otherSays.length).toBeGreaterThan(0);
      expect(s.starters.length).toBeGreaterThanOrEqual(2);
      expect(s.checks.length).toBeGreaterThanOrEqual(2);
      expect(new Set(s.checks.map((c) => c.id)).size).toBe(s.checks.length);
      for (const c of s.checks) expect(c.nextTime).toMatch(/^Next time, /);
      expect(s.stretch).toMatch(/^Next time, /);
    }
  });

  it('stays away from the office, verdict words and emoji', () => {
    const text = JSON.stringify(SITUATIONS).toLowerCase();
    expect(text).not.toMatch(/\b(agenda|manager|boss|client|colleague|office|correct|pronunciation|grammar)\b/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('only finds real ids', () => {
    expect(situationById('late')?.id).toBe('late');
    for (const bad of ['nope', undefined, ['late'], '']) expect(situationById(bad)).toBeUndefined();
  });
});

describe('situation steps', () => {
  it('runs example, supported, independent, self-check, result', () => {
    let flow = startFlow();
    expect(flow.stage).toBe('example');
    flow = readyToRespond(flow);
    expect(flow.stage).toBe('supported');
    flow = responseHeard(flow, 6);
    expect(flow).toMatchObject({ stage: 'independent', supportedWords: 6 });
    flow = responseHeard(flow, 9);
    expect(flow).toMatchObject({ stage: 'selfcheck', independentWords: 9 });
    expect(finishCheck(flow).stage).toBe('result');
  });

  it('holds a too-short answer on its step until Try again clears it', () => {
    const flow = responseHeard(readyToRespond(startFlow()), MIN_RESPONSE_WORDS - 1);
    expect(flow).toMatchObject({ stage: 'supported', tooShort: MIN_RESPONSE_WORDS - 1, supportedWords: 0 });
    expect(clearTooShort(flow).tooShort).toBeNull();
    expect(responseHeard(clearTooShort(flow), MIN_RESPONSE_WORDS).stage).toBe('independent');
  });

  it('records opening the starters only on the independent step', () => {
    const supported = readyToRespond(startFlow());
    expect(openStarters(supported).startersOpened).toBe(false);
    const independent = responseHeard(supported, 5);
    expect(independent.startersOpened).toBe(false);
    const opened = openStarters(independent);
    expect(opened.startersOpened).toBe(true);
    // A too-short retry can't wipe it: the record stays honest for this attempt.
    expect(clearTooShort(responseHeard(opened, 0)).startersOpened).toBe(true);
    expect(situationRecord(first, responseHeard(opened, 9), 1).startersOpened).toBe(true);
  });

  it('retries on the independent step with starters hidden and the last go cleared', () => {
    let flow = openStarters(responseHeard(readyToRespond(startFlow()), 5));
    flow = toggleTick(responseHeard(flow, 9), 'name');
    flow = retry(finishCheck(flow));
    expect(flow).toMatchObject({ stage: 'independent', attempt: 2, startersOpened: false, independentWords: 0, ticks: [], tooShort: null, supportedWords: 5 });
  });

  it('toggles ticks only during the self-check', () => {
    expect(toggleTick(startFlow(), 'name').ticks).toEqual([]);
    const ticked = toggleTick(atCheck(), 'name');
    expect(ticked.ticks).toEqual(['name']);
    expect(toggleTick(ticked, 'name').ticks).toEqual([]);
  });

  it('saves only ids and numbers, keeps unknown ticks out, and has no field for words said', () => {
    const flow = toggleTick(toggleTick(atCheck(), 'name'), 'made_up');
    const record = situationRecord(first, flow, 42);
    expect(record).toEqual({ situationId: 'meet_new', at: 42, attempt: 1, startersOpened: false, supportedWords: 5, independentWords: 8, ticks: ['name'], checks: 2 });
  });
});

describe('situation feedback', () => {
  it('names the first thing left unticked', () => {
    const f = situationFeedback(first, toggleTick(atCheck(), 'name'));
    expect(f.nextTime).toBe(first.checks[1].nextTime);
    expect(f.selfChecked).toBe('Self-checked: you ticked 1 of 2.');
  });

  it('asks for closed starters once every check is ticked with them open', () => {
    let flow = openStarters(responseHeard(readyToRespond(startFlow()), 5));
    flow = responseHeard(flow, 8);
    for (const c of first.checks) flow = toggleTick(flow, c.id);
    expect(situationFeedback(first, flow).nextTime).toMatch(/starters closed/);
    expect(situationFeedback(first, flow).starters).toMatch(/opened/);
  });

  it('gives the stretch when everything is ticked without starters', () => {
    let flow = atCheck();
    for (const c of first.checks) flow = toggleTick(flow, c.id);
    expect(situationFeedback(first, flow).nextTime).toBe(first.stretch);
  });

  it('counts a single word in the singular', () => {
    expect(heardLine(1)).toBe('The phone heard 1 word.');
    expect(heardLine(2)).toBe('The phone heard 2 words.');
  });
});

describe('next situation', () => {
  it('starts at the first and moves in order', () => {
    expect(nextSituation([]).id).toBe('meet_new');
    expect(nextSituation([rec('meet_new')]).id).toBe('ask_help');
  });

  it('never repeats the one just left, even if it has the fewest', () => {
    const others = SITUATIONS.filter((s) => s.id !== 'late').map((s) => rec(s.id));
    expect(nextSituation(others).id).toBe('late');
    expect(nextSituation(others, 'late').id).not.toBe('late');
  });

  it('takes the oldest when counts tie and ignores ids it does not know', () => {
    const all = SITUATIONS.map((s, i) => rec(s.id, 100 - i));
    expect(nextSituation(all).id).toBe('late');
    expect(nextSituation([rec('gone')]).id).toBe('meet_new');
  });
});

describe('situation analytics', () => {
  it('survives sanitise whole, as codes and numbers', () => {
    const props = situationCompleteProps(rec('explain_problem'));
    expect(sanitise(props)).toEqual(props);
  });
});

describe('situation storage', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('keeps simultaneous saves, and stays out of the sessions key', async () => {
    await Promise.all([saveSituationRecord(rec('late')), saveSituationRecord(rec('clarify'))]);
    expect((await loadSituationRecords()).map((r) => r.situationId)).toEqual(['late', 'clarify']);
    expect(await AsyncStorage.getItem('mouthful.sessions.v1')).toBeNull();
  });

  it('survives broken storage and drops broken rows', async () => {
    await AsyncStorage.setItem('mouthful.situations.v1', '{nope');
    expect(await loadSituationRecords()).toEqual([]);
    await AsyncStorage.setItem('mouthful.situations.v1', JSON.stringify([rec('late'), { at: 'x' }, null]));
    expect(await loadSituationRecords()).toHaveLength(1);
  });

  it('caps what it keeps, oldest going first', async () => {
    await AsyncStorage.setItem('mouthful.situations.v1', JSON.stringify(Array.from({ length: MAX_RECORDS }, (_, i) => rec('late', i))));
    await saveSituationRecord(rec('clarify', 999));
    const all = await loadSituationRecords();
    expect(all).toHaveLength(MAX_RECORDS);
    expect(all[0].at).toBe(1);
    expect(all[all.length - 1].situationId).toBe('clarify');
  });

  it('refuses saves during a reset, then resumes', async () => {
    const resume = await pauseSituationWrites();
    expect(await saveSituationRecord(rec('late'))).toBe(false);
    resume();
    expect(await saveSituationRecord(rec('late'))).toBe(true);
  });

  it('is wiped by Reset all data', async () => {
    await saveSituationRecord(rec('late'));
    await wipeAllData('mouthful.profile.v1', null);
    expect(await loadSituationRecords()).toEqual([]);
  });
});
