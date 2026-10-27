/**
 * "Delete" has to remove the audio files themselves, not just our references to them.
 * expo-file-system is replaced with a tiny in-memory file system.
 */
const disk = new Set<string>();

jest.mock('expo-file-system', () => {
  const join = (a: string, b: string) => `${a.replace(/\/$/, '')}/${b}`;
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return disk.has(this.uri);
    }
    delete() {
      if (!disk.delete(this.uri)) throw new Error('missing');
    }
  }
  class Directory {
    uri: string;
    constructor(base: Directory | string, name?: string) {
      const root = typeof base === 'string' ? base : base.uri;
      this.uri = name ? join(root, name) : root;
    }
    get exists() {
      return disk.has(`${this.uri}/`) || [...disk].some((p) => p.startsWith(`${this.uri}/`));
    }
    create() {
      disk.add(`${this.uri}/`);
    }
    delete() {
      for (const p of [...disk]) if (p.startsWith(`${this.uri}/`)) disk.delete(p);
    }
    list() {
      const kids = new Map<string, File | Directory>();
      for (const p of disk) {
        if (!p.startsWith(`${this.uri}/`)) continue;
        const rest = p.slice(this.uri.length + 1);
        if (!rest) continue;
        const [head, ...more] = rest.split('/');
        kids.set(head, more.length ? new Directory(this, head) : new File(join(this.uri, head)));
      }
      return [...kids.values()];
    }
  }
  return { File, Directory, Paths: { document: new Directory('file:///docs'), cache: new Directory('file:///cache') } };
});

import { deleteAllRecordings, isRecordingName, listRecordings, recordingsFolderUri } from '../../store/recordings';
import { recordingUris } from '../../store/sessions';

beforeEach(() => disk.clear());

describe('recordings', () => {
  it('recognises only the recogniser’s own file names', () => {
    expect(isRecordingName('recording_1720678500903.wav')).toBe(true);
    expect(isRecordingName('recording_6A2B-11.caf')).toBe(true);
    expect(isRecordingName('my-notes.wav')).toBe(false);
    expect(isRecordingName('recording_1.txt')).toBe(false);
  });

  it('records into one folder', () => {
    expect(recordingsFolderUri()).toBe('file:///docs/recordings');
  });

  it('deletes every audio file, including strays from older builds, and leaves other files alone', () => {
    disk.add('file:///docs/recordings/recording_1.caf');
    disk.add('file:///docs/recordings/recording_2.caf');
    disk.add('file:///docs/recording_old.wav'); // older builds saved straight into Documents
    disk.add('file:///cache/recording_3.caf'); // the recogniser's default location
    disk.add('file:///docs/something-else.json');
    expect(listRecordings()).toHaveLength(4);

    const removed = deleteAllRecordings(['file:///docs/recordings/recording_1.caf', 'file:///gone/recording_9.caf']);
    expect(removed).toBe(4);
    expect([...disk]).toEqual(['file:///docs/something-else.json']);
    expect(listRecordings()).toHaveLength(0);
  });

  it('collects every file sessions point at', () => {
    const base = { id: 'a', passageId: 'baseline', title: '', date: 0, wpm: 0, fillersPerMin: 0, accuracy: 100, pauses: 0, seconds: 0, score: 0, stumbled: [] };
    expect(recordingUris([{ ...base, recordings: ['x', 'y'] }, { ...base, id: 'b' }, { ...base, id: 'c', recordings: ['z'] }] as never)).toEqual(['x', 'y', 'z']);
  });
});
