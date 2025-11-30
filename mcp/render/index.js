import { existsSync } from 'fs';
import path from 'path';
import { parseSonicPiFile } from './parser.js';
import { renderMidiFromEvents } from './midi-writer.js';
import { DEFAULT_BARS } from './constants.js';

export function renderSonicPiToMidi(options) {
  const { filePath, bars = DEFAULT_BARS, output, loopNames, drumSplit = true } = options;
  if (!filePath) throw new Error('filePath is required');
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error(`File not found: ${absolute}`);

  const parsed = parseSonicPiFile(absolute, { bars });
  let events = parsed.events;

  if (Array.isArray(loopNames) && loopNames.length > 0) {
    const allowed = new Set(loopNames);
    events = events.filter((evt) => allowed.has(evt.loopName));
  }

  if (!drumSplit) {
    events = events.map((evt) =>
      evt.isPercussion ? { ...evt, instrumentId: 'drums', loopName: evt.loopName || 'drums' } : evt
    );
  }

  const rendered = renderMidiFromEvents(events, { bpm: parsed.bpm, outputPath: output });
  return {
    midiPath: rendered.path,
    tracks: rendered.tracks,
    warnings: parsed.warnings,
    eventCount: events.length,
    targetBeats: parsed.targetBeats,
  };
}
