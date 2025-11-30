import { readFileSync } from 'fs';
import path from 'path';
import {
  DEFAULT_BARS,
  DEFAULT_BPM,
  BEATS_PER_BAR,
  DEFAULT_DURATION_BEATS,
  DEFAULT_VELOCITY,
  MAX_BARS,
} from './constants.js';
import {
  normalizeSymbol,
  parseNumber,
  noteSymbolToMidi,
  chordToMidis,
  velocityFromAmp,
  clampDuration,
} from './utils.js';
import { mapSampleToDrum } from './constants.js';

function extractGlobalBpm(code) {
  const match = code.match(/use_bpm\s+([0-9.]+)/);
  return match ? parseNumber(match[1]) || DEFAULT_BPM : DEFAULT_BPM;
}

function splitLiveLoops(code) {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const loops = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const liveMatch = line.match(/^live_loop\s+:([\w\d_]+)\s+do/);
    if (!liveMatch) {
      i += 1;
      continue;
    }
    const name = liveMatch[1];
    const body = [];
    let depth = 1;
    i += 1;
    for (; i < lines.length; i += 1) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (/\bdo\b/.test(trimmed)) depth += 1;
      if (/^end\b/.test(trimmed)) {
        depth -= 1;
        if (depth === 0) break;
      }
      if (depth > 0) body.push(raw);
    }
    loops.push({ name, body });
    i += 1;
  }
  return loops;
}

function collectDoEndBlock(lines, startIndex) {
  const body = [];
  let depth = 1;
  let i = startIndex;
  for (; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/\bdo\b/.test(trimmed)) depth += 1;
    if (/^end\b/.test(trimmed)) {
      depth -= 1;
      if (depth === 0) break;
    }
    if (depth > 0) body.push(lines[i]);
  }
  return { body, nextIndex: i + 1 };
}

function parseHashArgs(argStr) {
  const opts = {};
  if (!argStr) return opts;
  const regex = /([a-zA-Z_][\w]*):\s*([^,]+)/g;
  let match;
  while ((match = regex.exec(argStr))) {
    const key = match[1];
    const raw = match[2].trim();
    const num = parseNumber(raw);
    opts[key] = Number.isFinite(num) ? num : raw.replace(/['"]/g, '');
  }
  return opts;
}

function parsePlay(line, loopName, context) {
  // chord
  const chordMatch = line.match(/chord\(([^)]+)\)/);
  if (chordMatch) {
    const args = chordMatch[1].split(',').map((s) => s.trim());
    const tonic = args[0];
    const quality = args[1] || 'major';
    const notes = chordToMidis(tonic, quality);
    const opts = parseHashArgs(line.slice(line.indexOf('chord(') + chordMatch[0].length));
    return buildEvent(notes, loopName, context, opts);
  }
  const playMatch = line.match(/play\s+([:\w#][\w#]*)\s*(.*)/);
  if (!playMatch) return null;
  const target = playMatch[1];
  const notes = [];
  const midi = noteSymbolToMidi(target);
  if (midi !== null) notes.push(midi);
  const opts = parseHashArgs(playMatch[2]);
  return buildEvent(notes, loopName, context, opts);
}

function parseSample(line, loopName, context) {
  const match = line.match(/sample\s+([:\w][\w_]*)\s*(.*)/);
  if (!match) return null;
  const sampleName = normalizeSymbol(match[1]);
  const opts = parseHashArgs(match[2]);
  const drum = mapSampleToDrum(sampleName);
  const notes = drum ? [drum.midi] : [60]; // fallback middle C for non-drums
  return {
    type: 'note',
    notes,
    instrumentId: drum ? `drum:${drum.id}` : `sample:${sampleName}`,
    isPercussion: Boolean(drum),
    startBeat: context.time,
    durationBeats: clampDuration(opts.release ?? DEFAULT_DURATION_BEATS) ?? DEFAULT_DURATION_BEATS,
    startSec: context.timeSec,
    durationSec:
      clampDuration(opts.release ?? DEFAULT_DURATION_BEATS) === null
        ? null
        : (clampDuration(opts.release ?? DEFAULT_DURATION_BEATS) ?? DEFAULT_DURATION_BEATS) *
          (60 / context.bpm),
    velocity: velocityFromAmp(opts.amp) ?? context.defaults.velocity,
    loopName,
    bpm: context.bpm,
  };
}

function buildEvent(notes, loopName, context, opts) {
  if (!notes || notes.length === 0) return null;
  const duration =
    clampDuration(opts.release ?? opts.sustain ?? context.defaults.duration ?? DEFAULT_DURATION_BEATS) ??
    DEFAULT_DURATION_BEATS;
  return {
    type: 'note',
    notes,
    instrumentId: context.synth ? `synth:${context.synth}` : 'synth:default',
    isPercussion: false,
    startBeat: context.time,
    startSec: context.timeSec,
    durationBeats: duration,
    durationSec: duration * (60 / context.bpm),
    velocity: velocityFromAmp(opts.amp) ?? context.defaults.velocity,
    loopName,
    bpm: context.bpm,
  };
}

function parseBlock(lines, loopName, baseContext, warnings) {
  const events = [];
  let timeBeats = 0;
  let timeSec = 0;
  const offsetBeats = baseContext.offsetBeats ?? 0;
  const offsetSec = baseContext.offsetSec ?? 0;
  const context = {
    bpm: baseContext.bpm,
    synth: baseContext.synth,
    defaults: { velocity: DEFAULT_VELOCITY, duration: DEFAULT_DURATION_BEATS, ...baseContext.defaults },
    time: timeBeats,
    timeSec,
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      i += 1;
      continue;
    }

    const bpmMatch = line.match(/^use_bpm\s+([0-9.]+)/);
    if (bpmMatch) {
      const bpmVal = parseNumber(bpmMatch[1]);
      if (bpmVal) context.bpm = bpmVal;
      i += 1;
      continue;
    }

    const synthMatch = line.match(/^use_synth\s+:?([\w\d_]+)/);
    if (synthMatch) {
      context.synth = synthMatch[1];
      i += 1;
      continue;
    }

    const defaultsMatch = line.match(/^use_synth_defaults\s+(.*)/);
    if (defaultsMatch) {
      const opts = parseHashArgs(defaultsMatch[1]);
      if (opts.amp !== undefined) context.defaults.velocity = velocityFromAmp(opts.amp);
      if (opts.release !== undefined) context.defaults.duration = clampDuration(opts.release);
      i += 1;
      continue;
    }

    const timesMatch = line.match(/^(\d+)\.times\s+do/);
    if (timesMatch) {
      const repeat = Number(timesMatch[1]);
      const { body, nextIndex } = collectDoEndBlock(lines, i + 1);
      const inner = parseBlock(body, loopName, { ...context, offsetBeats: 0, offsetSec: 0 }, warnings);
      const span = inner.lengthBeats || 0;
      const spanSec = inner.lengthSec || 0;
      for (let r = 0; r < repeat; r += 1) {
        inner.events.forEach((evt) => {
          events.push({
            ...evt,
            startBeat: offsetBeats + timeBeats + evt.startBeat + span * r,
            startSec: offsetSec + timeSec + evt.startSec + spanSec * r,
          });
        });
      }
      timeBeats += span * repeat;
      timeSec += spanSec * repeat;
      context.time = timeBeats;
      context.timeSec = timeSec;
      i = nextIndex;
      continue;
    }

    const sleepMatch = line.match(/^sleep\s+([0-9.]+)/);
    if (sleepMatch) {
      const duration = parseNumber(sleepMatch[1]) || 0;
      timeBeats += duration;
      timeSec += duration * (60 / context.bpm);
      context.time = timeBeats;
      context.timeSec = timeSec;
      i += 1;
      continue;
    }

    const withBpmMatch = line.match(/^with_bpm\s+([0-9.]+)\s+do/);
    if (withBpmMatch) {
      const childBpm = parseNumber(withBpmMatch[1]) || context.bpm;
      const { body, nextIndex } = collectDoEndBlock(lines, i + 1);
      const inner = parseBlock(body, loopName, { ...context, bpm: childBpm, offsetBeats: 0, offsetSec: 0 }, warnings);
      inner.events.forEach((evt) =>
        events.push({
          ...evt,
          startBeat: evt.startBeat + offsetBeats + timeBeats,
          startSec: evt.startSec + offsetSec + timeSec,
        })
      );
      timeBeats += inner.lengthBeats;
      timeSec += inner.lengthSec;
      context.time = timeBeats;
      context.timeSec = timeSec;
      i = nextIndex;
      continue;
    }

    const playEvent = parsePlay(line, loopName, context);
    if (playEvent) {
      events.push({
        ...playEvent,
        startBeat: playEvent.startBeat + offsetBeats,
        startSec: playEvent.startSec + offsetSec,
      });
      i += 1;
      continue;
    }

    const sampleEvent = parseSample(line, loopName, context);
    if (sampleEvent) {
      events.push({
        ...sampleEvent,
        startBeat: sampleEvent.startBeat + offsetBeats,
        startSec: sampleEvent.startSec + offsetSec,
      });
      i += 1;
      continue;
    }

    // Unsupported
    warnings.push(`Skipped line in ${loopName}: "${line}"`);
    i += 1;
  }

  const lastEventEnd = events.reduce(
    (max, evt) => Math.max(max, evt.startBeat + (evt.durationBeats || 0)),
    0
  );
  const lengthBeats = Math.max(timeBeats, lastEventEnd - offsetBeats);
  const lastEventEndSec = events.reduce(
    (max, evt) => Math.max(max, evt.startSec + (evt.durationSec || 0)),
    0
  );
  const lengthSec = Math.max(timeSec, lastEventEndSec - offsetSec);
  return { events, lengthBeats, lengthSec, baseTime: timeBeats, baseTimeSec: timeSec };
}

export function parseSonicPiFile(filePath, options = {}) {
  const absolute = path.resolve(filePath);
  const code = readFileSync(absolute, 'utf8');
  return parseSonicPiCode(code, options);
}

export function parseSonicPiCode(code, options = {}) {
  const warnings = [];
  const bars = Math.min(options.bars || DEFAULT_BARS, MAX_BARS);
  const targetBeats = bars * BEATS_PER_BAR;
  const globalBpm = extractGlobalBpm(code);
  const baseBpm = options.bpmOverride || globalBpm || DEFAULT_BPM;
  const targetSeconds = targetBeats * (60 / baseBpm);
  const loops = splitLiveLoops(code);
  const events = [];

  if (loops.length === 0) {
    const lines = code.replace(/\r\n/g, '\n').split('\n');
    const parsed = parseBlock(
      lines,
      'main',
      { bpm: globalBpm, synth: null, defaults: {}, offsetBeats: 0, offsetSec: 0 },
      warnings
    );
    appendLoopEvents(events, parsed, 'main', targetBeats, targetSeconds);
  } else {
    for (const loop of loops) {
      const parsed = parseBlock(
        loop.body,
        loop.name,
        { bpm: globalBpm, synth: null, defaults: {}, offsetBeats: 0, offsetSec: 0 },
        warnings
      );
      appendLoopEvents(events, parsed, loop.name, targetBeats, targetSeconds);
    }
  }

  return {
    bpm: globalBpm,
    events: events.filter((evt) => evt.startSec < targetSeconds),
    warnings,
    targetBeats,
    targetSeconds,
  };
}

function appendLoopEvents(container, parsed, loopName, targetBeats, targetSeconds) {
  const span = parsed.lengthBeats || BEATS_PER_BAR;
  const spanSec = parsed.lengthSec || (span * 60) / DEFAULT_BPM;
  const safeSpan = span > 0 ? span : BEATS_PER_BAR;
  const safeSpanSec = spanSec > 0 ? spanSec : (BEATS_PER_BAR * 60) / DEFAULT_BPM;
  const iterations = Math.ceil(targetSeconds / safeSpanSec);
  for (let i = 0; i < iterations; i += 1) {
    const offsetBeats = i * safeSpan;
    const offsetSec = i * safeSpanSec;
    parsed.events.forEach((evt) => {
      const startBeat = evt.startBeat + offsetBeats;
      const startSec = evt.startSec + offsetSec;
      if (startSec >= targetSeconds) return;
      container.push({ ...evt, startBeat, startSec });
    });
  }
}
