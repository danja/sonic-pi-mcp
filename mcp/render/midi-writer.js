import { writeFileSync } from 'fs';
import path from 'path';
import MidiPackage from '@tonejs/midi';
import { synthToProgram, DEFAULT_BPM } from './constants.js';

const DRUM_CHANNEL = 9; // zero-based MIDI channel 10
const { Midi } = MidiPackage;

export function renderMidiFromEvents(events, options = {}) {
  const midi = new Midi();
  const bpm = options.bpm || DEFAULT_BPM;
  midi.header.setTempo(bpm);

  const channelPool = createChannelPool();
  const tracks = new Map();
  const trackMeta = [];

  for (const evt of events) {
    const trackKey = getTrackKey(evt);
    if (!tracks.has(trackKey)) {
      const track = midi.addTrack();
      const channel = evt.isPercussion ? DRUM_CHANNEL : channelPool.next().value;
      const instrumentNumber = evt.isPercussion ? 0 : synthToProgram(extractSynthName(evt.instrumentId));
      track.channel = channel;
      track.instrument.number = instrumentNumber;
      track.name = trackKey;
      tracks.set(trackKey, { track, channel, instrumentNumber });
      trackMeta.push({
        name: trackKey,
        channel,
        instrumentNumber,
        isPercussion: evt.isPercussion,
      });
    }
    const { track, channel } = tracks.get(trackKey);
    const secondsPerBeat = 60 / (evt.bpm || bpm);
    const time =
      evt.startSec !== undefined
        ? evt.startSec
        : (evt.startBeat || 0) * secondsPerBeat;
    const duration =
      evt.durationSec !== undefined
        ? evt.durationSec
        : (evt.durationBeats || 0.25) * secondsPerBeat;
    for (const note of evt.notes || []) {
      track.addNote({
        midi: note,
        time,
        duration,
        velocity: evt.velocity ?? 0.8,
        channel,
      });
    }
  }

  const array = midi.toArray();
  const outPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.resolve(process.cwd(), `render-${Date.now()}.mid`);
  writeFileSync(outPath, Buffer.from(array));

  return { path: outPath, tracks: trackMeta };
}

function getTrackKey(evt) {
  if (evt.isPercussion) return evt.instrumentId || 'drum:unknown';
  return `${evt.instrumentId || 'synth:default'}:${evt.loopName || 'main'}`;
}

function* createChannelPool() {
  const channels = [];
  for (let i = 0; i < 16; i += 1) {
    if (i === DRUM_CHANNEL) continue;
    channels.push(i);
  }
  let idx = 0;
  while (true) {
    yield channels[idx % channels.length];
    idx += 1;
  }
}

function extractSynthName(instrumentId) {
  if (!instrumentId) return null;
  const parts = instrumentId.split(':');
  return parts[1] || parts[0];
}
