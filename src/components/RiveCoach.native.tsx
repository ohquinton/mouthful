import { useEffect, useState } from 'react';
import { RiveView, useRiveFile, useRiveNumber, useViewModelInstance } from '@rive-app/react-native';
import { Drop } from './Drop';
import { COACH_MODE, type CoachProps } from './coachState';

/** Imported only through Coach.native's guarded loader. No remote asset or microphone access. */
export function RiveCoach({ height = 44, state = 'idle' }: CoachProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro's bundled asset reference
  const { riveFile, error: fileError } = useRiveFile(require('../../assets/rive/drop.riv'));
  const { instance, error: instanceError } = useViewModelInstance(riveFile, { async: true });
  const { value, setValue, error: modeError } = useRiveNumber('mode', instance);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (instance && value !== undefined && value !== COACH_MODE[state]) setValue(COACH_MODE[state]); }, [instance, state, value, setValue]);
  if (!riveFile || !instance || fileError || instanceError || modeError || failed) {
    return <Drop height={height} pose={state === 'thinking' ? 'up' : 'rest'} alive={false} />;
  }
  const scale = height / 156;
  return <RiveView file={riveFile} dataBind={instance} artboardName="Drop" stateMachineName="Coach"
    frameRate={30} onError={() => setFailed(true)}
    style={{ position: 'absolute', width: 300 * scale, height: 300 * scale, left: -94 * scale, top: -88 * scale }} />;
}
