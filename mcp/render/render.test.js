import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { renderSonicPiToMidi } from './index.js';

const SAMPLE_CODE = `
use_bpm 120

live_loop :drums do
  sample :drum_bass_hard, amp: 1
  sleep 1
  sample :drum_snare_hard
  sleep 1
end

live_loop :bass do
  use_synth :tb303
  play :c2, release: 0.5
  sleep 1
end
`;

describe('renderSonicPiToMidi', () => {
  it('renders MIDI with separate drum tracks', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'render-test-'));
    const filePath = path.join(tmp, 'pattern.rb');
    const outPath = path.join(tmp, 'out.mid');
    writeFileSync(filePath, SAMPLE_CODE);

    const result = renderSonicPiToMidi({ filePath, bars: 2, output: outPath });

    const stats = statSync(result.midiPath);
    expect(stats.size).toBeGreaterThan(0);
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.tracks.length).toBeGreaterThanOrEqual(2);
    const drumTracks = result.tracks.filter((t) => t.isPercussion);
    expect(drumTracks.length).toBeGreaterThanOrEqual(2); // kick + snare split

    rmSync(tmp, { recursive: true, force: true });
  });
});
