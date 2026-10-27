import { Directory, File, Paths } from 'expo-file-system';

/**
 * Every recording lives in one folder, so "delete" can't miss any.
 * Older builds saved straight into Documents (and the recogniser defaults to Caches),
 * so deletion also sweeps those for files the recogniser names `recording_*`.
 */
const FOLDER = 'recordings';

export const isRecordingName = (name: string) => /^recording_[\w-]+\.(wav|caf|m4a|aac)$/i.test(name);

function folder(): Directory {
  return new Directory(Paths.document, FOLDER);
}

/** The folder to record into, created if needed. Undefined when the file system isn't available (web). */
export function recordingsFolderUri(): string | undefined {
  try {
    const d = folder();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    return d.uri;
  } catch {
    return undefined;
  }
}

/** Every recording file on the phone. */
export function listRecordings(): File[] {
  const found: File[] = [];
  const seen = new Set<string>();
  const scan = (d: Directory, all: boolean) => {
    try {
      if (!d.exists) return;
      for (const e of d.list()) {
        if (e instanceof File && (all || isRecordingName(e.name)) && !seen.has(e.uri)) {
          seen.add(e.uri);
          found.push(e);
        }
      }
    } catch {}
  };
  scan(folder(), true);
  scan(Paths.document, false);
  scan(Paths.cache, false);
  return found;
}

/**
 * Deletes the audio itself, not just our references to it.
 * `knownUris` are the files sessions point at (in case any were saved elsewhere).
 * Returns how many files were removed.
 */
export function deleteAllRecordings(knownUris: string[] = []): number {
  let removed = 0;
  const del = (f: File) => {
    try {
      if (f.exists) {
        f.delete();
        removed++;
      }
    } catch {}
  };
  for (const uri of knownUris) {
    try {
      del(new File(uri));
    } catch {}
  }
  listRecordings().forEach(del);
  try {
    const d = folder();
    if (d.exists) d.delete();
  } catch {}
  return removed;
}

/** Deletes specific files, e.g. the audio from an attempt that was too short to keep. */
export function deleteRecordingFiles(uris: string[]): void {
  for (const uri of uris) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {}
  }
}
