import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import MidiPackage from '@tonejs/midi';
import { renderSonicPiToMidi } from './index.js';
const { Midi } = MidiPackage;

const WITH_BPM_CODE = `
use_bpm 60

live_loop :drums do
  with_bpm 120 do
    sample :drum_bass_hard
    sleep 1
  end
  sample :drum_snare_hard
  sleep 1
end
`;

describe('render roundtrip MIDI parsing', () => {
  it('aligns with_bpm timing when re-read from MIDI', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'render-roundtrip-'));
    const filePath = path.join(tmp, 'with_bpm.rb');
    const outPath = path.join(tmp, 'with_bpm.mid');
    writeFileSync(filePath, WITH_BPM_CODE);

    renderSonicPiToMidi({ filePath, bars: 1, output: outPath });

    const midi = new Midi(readFileSync(outPath));
    const drumTracks = midi.tracks.filter((t) => t.channel === 9);
    // expect at least kick and snare tracks
    expect(drumTracks.length).toBeGreaterThanOrEqual(2);

    const kickTrack = drumTracks.find((t) => t.notes.some((n) => n.midi === 36));
    const snareTrack = drumTracks.find((t) => t.notes.some((n) => n.midi === 38));
    expect(kickTrack).toBeTruthy();
    expect(snareTrack).toBeTruthy();

    const firstKick = kickTrack.notes[0];
    const firstSnare = snareTrack.notes[0];
    const delta = firstSnare.time - firstKick.time;
    expect(delta).toBeGreaterThan(0.45);
    expect(delta).toBeLessThan(0.6); // around 0.5s

    rmSync(tmp, { recursive: true, force: true });
  });
});
