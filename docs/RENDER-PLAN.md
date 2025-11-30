# Sonic Pi → MIDI Rendering Plan

Goal: add a system and MCP tool that reads Sonic Pi `.rb` scripts and renders them to `.mid` files with one MIDI track per instrument. Percussion must be split per-instrument (e.g., kick, snare, hats on separate tracks, even if all map to channel 10).

## Scope and constraints
- Input: offline Sonic Pi Ruby files (not live sessions). Assume sane use of `live_loop`, `use_bpm`, `use_synth`, `sample`, `play`, `sleep`, chord helpers.
- Output: Standard MIDI file (`.mid`) with tempo map, program changes, and per-instrument tracks; drum notes on channel 10 but separated by instrument-specific tracks.
- Non-goals: Perfect execution of arbitrary Ruby metaprogramming, real-time OSC rendering, or audio rendering.

## Architecture outline
1) **Parse Sonic Pi file → timeline IR**
   - Use `web-tree-sitter` + `tree-sitter-ruby` to parse to an AST. Fallback to a narrow DSL parser for core constructs if tree-sitter fails (still deterministic).
   - Walk the AST to extract `live_loop` blocks (or top-level sequences), building an event list with timestamps, duration, velocity, and instrument metadata.
   - Honor `use_bpm` (default 60) and local `use_bpm` inside loops; compute absolute times in seconds and beats.
   - Track `use_synth`/`use_synth_defaults` and `sample` calls; infer instrument kind: melodic vs percussion. Map chord helpers (`chord(:c, :m7)`) to note arrays.
   - Handle timing by summing `sleep` calls; for concurrency, each `live_loop` becomes its own sequence starting at t=0. Support a finite unwind of loops to a configurable bar count (default 8 bars) to avoid infinite output.
   - Unsupported constructs (randomization, conditional branching on runtime data) emit warnings and deterministic placeholders (e.g., choose first branch or seed randomness).
2) **Instrument + drum mapping**
   - Melodic synths: map common Sonic Pi synths to General MIDI programs (e.g., `:tb303` → Synth Bass 2, `:fm` → Bass, `:prophet` → Pad). Fallback to Acoustic Grand.
   - Samples: maintain a lookup for drum samples → GM percussion note numbers (kick 36, snare 38, closed hat 42, open hat 46, clap 39, cymbal 49, etc.). Non-drum samples default to a melodic program track.
   - Track allocation: one track per unique instrument identity. For drums, split by instrument name (kick, snare, hat, clap, cymbal, tom). For melodic, split by synth name + `live_loop` name.
3) **MIDI writer layer**
   - Use a Node MIDI library (candidate: `@tonejs/midi` for simple event writing; alternative: `midiconvert`/`midi-writer-js`). Choose a library that supports tempo map, per-track channel selection, and easy note events.
   - Build MIDI tracks from the IR, assign channels (melodic channels 1–9/11–16; drums on 10), write program changes for melodic tracks, and tempo events at start (plus changes if BPM changes mid-track).
   - Export to `.mid` buffer and write to disk at a requested path or to a temp file returned by the MCP tool.
4) **MCP tool surface**
   - New tool `render_midi` (name TBD) with params: `path` (string, Sonic Pi `.rb` file), `bars` (optional int, default 8), `output` (optional path for `.mid`), `loop_names` (optional array to include/exclude), and `drum_split` (bool, default true).
   - Flow: validate path → parse + IR → render MIDI → write file → return metadata (absolute path, track list with instruments, warnings).
   - Errors surface as structured MCP errors (invalid file, parse failure, unsupported constructs).

## Event extraction details
- **Timing**: Convert beats to seconds via BPM; accumulate per loop. Respect nested `with_bpm` or `use_bpm` overrides. Treat `sleep` with floats; error on negative/zero sleeps.
- **Notes**: `play <int|symbol>` for single notes; `play chord(...)` for multiple simultaneous notes; support `synth` arg overrides on `play`.
- **Samples**: `sample :drum_snare_hard` etc. Convert to drum note events (fixed short duration, configurable velocity).
- **Dynamics**: Use `amp`, `release`, `attack` when present to approximate velocity and note length; otherwise set sensible defaults (e.g., 0.8 velocity, 0.25 beat duration).
- **Loops**: Unroll `live_loop`/`loop do` deterministically up to `bars` target; stop when cumulative beats exceed target.

## Testing plan
- Unit tests for AST extraction (Ruby snippets → IR events), instrument mapping, drum splitting, tempo handling, chord expansion, and loop unrolling bounds.
- Integration tests: convert fixture `.rb` files from `/examples` (hip hop, rock) and assert MIDI tracks/counts/instruments. Use mock FS/temp dirs.
- Golden-file tests: render MIDI, parse back with MIDI reader to assert note timelines and channels.
- Error-path tests: unsupported constructs, missing sleeps, malformed Ruby.

## Work plan (incremental)
1) Add dependencies (`web-tree-sitter`, `tree-sitter-ruby`, MIDI writer lib) and scaffolding files under `mcp/render/` (parser, mapper, writer).
2) Build IR + parser walker with fixtures; land unit tests.
3) Implement instrument/drum mapping and track allocation logic; add drum-split tests.
4) Implement MIDI writer layer and integration tests that read back MIDI.
5) Add MCP tool definition in `mcp/server.js` (schema, handler, wiring) plus documentation in `README.md` and examples.
6) Polish: warnings/messages, limits (bars), file output handling, and final regression tests across existing server features.
