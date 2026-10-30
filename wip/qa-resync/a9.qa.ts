import { run } from './h';
const T = 'The ward was quiet until the storm knocked the power out. Mara steadied the lantern and walked the hallway room by room. Nobody panicked, and a patient asked if this happened often.';
test('x', () => {
  for (const s of [
    'the ward was quiet until the storm knocked the power out walked the hallway room by',
    'the ward was quiet until the storm knocked the power out walked the hallway rum bye',
    'the ward was quiet until the storm knocked the power out walked the hallway room by room nobody',
    'the ward was quiet until the storm knocked the power out walked the hallway room by room nobody pan ic',
    'the ward was quiet until the storm knocked the power out walked the hallway room by room nobody panicked and a patient asked if this happened often',
  ]) { const r = run(T, s); console.log(`next=${r.a.next} ${r.show}`); }
});
