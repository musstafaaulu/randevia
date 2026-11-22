// Records real wall-clock timestamps for narration beats during a recording,
// relative to whatever moment recording actually started - so captions line
// up with what's actually happening on screen instead of being guessed
// after the fact. `minDisplayMs` is enforced later, in 07-assemble.mjs, when
// turning these into on-screen windows.
export function createTimeline() {
  const startedAt = Date.now();
  const events = [];
  return {
    log(tr, en) {
      events.push({ t: Date.now() - startedAt, tr, en });
    },
    events,
  };
}
