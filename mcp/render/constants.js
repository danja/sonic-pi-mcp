export const DEFAULT_BPM = 60;
export const DEFAULT_BARS = 8;
export const BEATS_PER_BAR = 4; // assume 4/4
export const DEFAULT_VELOCITY = 0.8;
export const DEFAULT_DURATION_BEATS = 0.25;
export const MAX_BARS = 64;

export const SYNTH_PROGRAMS = {
  tb303: 38, // Synth Bass 1 (0-based)
  fm: 33, // Electric Bass (finger)
  prophet: 88, // Pad 2 (warm)
  hoover: 122, // Polysynth
  tech_saws: 82, // Saw lead
  supersaw: 81,
  dsaw: 81,
  chipbass: 57, // Synth strings alt
};

export const DRUM_NOTE_MAP = {
  drum_bass_hard: { midi: 36, id: 'kick' },
  bd_haus: { midi: 36, id: 'kick' },
  drum_heavy_kick: { midi: 36, id: 'kick' },
  drum_bass_soft: { midi: 35, id: 'kick' },
  drum_snare_hard: { midi: 38, id: 'snare' },
  drum_snare_soft: { midi: 40, id: 'snare' },
  drum_cymbal_closed: { midi: 42, id: 'hat_closed' },
  hat_tap: { midi: 42, id: 'hat_closed' },
  drum_cymbal_pedal: { midi: 44, id: 'hat_pedal' },
  drum_cymbal_open: { midi: 46, id: 'hat_open' },
  drum_cymbal_soft: { midi: 49, id: 'cymbal' },
  drum_cymbal_hard: { midi: 49, id: 'cymbal' },
  drum_tom_lo_soft: { midi: 45, id: 'tom_lo' },
  drum_tom_lo_hard: { midi: 41, id: 'tom_lo' },
  drum_tom_mid_soft: { midi: 47, id: 'tom_mid' },
  drum_tom_mid_hard: { midi: 48, id: 'tom_mid' },
  drum_tom_hi_soft: { midi: 50, id: 'tom_hi' },
  drum_tom_hi_hard: { midi: 50, id: 'tom_hi' },
  drum_cowbell: { midi: 56, id: 'cowbell' },
  perc_bell: { midi: 56, id: 'bell' },
  perc_snap: { midi: 39, id: 'clap' },
  clap: { midi: 39, id: 'clap' },
  tabla_tas1: { midi: 60, id: 'tabla' },
  tabla_ke1: { midi: 61, id: 'tabla' },
};

export function synthToProgram(synth) {
  if (!synth) return 0;
  const key = synth.toLowerCase().replace(/^:/, '');
  return SYNTH_PROGRAMS[key] ?? 0;
}

export function mapSampleToDrum(sampleName) {
  if (!sampleName) return null;
  const key = sampleName.toLowerCase().replace(/^:/, '');
  return DRUM_NOTE_MAP[key] || null;
}
