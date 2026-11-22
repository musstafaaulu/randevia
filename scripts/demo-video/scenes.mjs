// Single source of truth for scene order and ids. Captions are no longer
// fixed per scene here - each recording script logs its own narration beats
// (with real timestamps) to raw/<id>-events.json via lib/timeline.mjs, and
// 07-assemble.mjs turns those into synced on-screen captions.
export const SCENE_IDS = [
  '01-tanitim-giris-arama',
  '02-split-screen-rezervasyon',
  '03-randevularim-ics',
  '04a-tema',
  '04b-mobil',
  '05-admin-panel',
  '06-teknik',
];

export const RAW_DIR = 'raw';
export const CLIPS_DIR = 'clips';
export const FINAL_DIR = 'final';
