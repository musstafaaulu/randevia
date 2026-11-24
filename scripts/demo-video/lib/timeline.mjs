// Records real wall-clock timestamps for narration beats during a recording,
// relative to whatever moment recording actually started - so captions line
// up with what's actually happening on screen instead of being guessed
// after the fact. `minDisplayMs` is enforced later, in 07-assemble.mjs, when
// turning these into on-screen windows.
//
// Also records "pan" markers (see lib/scrollPan.mjs): the time window during
// which the raw recording shows a real-but-ugly instant scroll jump, which
// 07-assemble.mjs later cuts out and replaces with a synthesized smooth pan.
export function createTimeline() {
  const startedAt = Date.now();
  const events = [];
  const pans = [];
  return {
    log(tr, en) {
      events.push({ t: Date.now() - startedAt, tr, en });
    },
    elapsedMs() {
      return Date.now() - startedAt;
    },
    markPan(pan) {
      pans.push(pan);
    },
    events,
    pans,
  };
}
