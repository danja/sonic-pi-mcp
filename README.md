# sp-mc

This connects any MCP client with [Sonic Pi](https://sonic-pi.net/) enabling you to create music with English.

**Tell Claude : "Use mcp to create an Acid House track with 120 bpm in the key of F"**

## Sonic Pi MCP Server

*I wanted to use [mcp-sonic-pi](https://github.com/vinayak-mehta/mcp-sonic-pi) but had version issues on my system so ported it to Node*

So far only tested on a Linux system with Claude Code.

### Current status
- Live OSC tools (`initialize_sonic_pi`, `play_music`, etc.) unchanged and working as before.
- New `render_midi` tool can read Sonic Pi `.rb` files and export `.mid` with per-instrument tracks (drums split per instrument). It now honors `with_bpm` blocks, simple `.times` repetition, common `live_loop` patterns, and maps popular drum samples to separate tracks.

### Features
- Direct OSC communication with Sonic Pi (no psonic dependency)
- Supports both Sonic Pi v3.x and v4.x
- Automatic port detection from Sonic Pi log files

The server provides six tools:

- `initialize_sonic_pi` - Initialize connection to Sonic Pi
- `play_music` - Execute Sonic Pi code
- `stop_music` - Stop all playback
- `get_beat_pattern` - Get beat patterns (blues, rock, hiphop, electronic)
- `make_acid` - Generate an Acid House style track
- `render_midi` - Read a Sonic Pi `.rb` file and render a `.mid` file with one track per instrument (drums split per instrument)

### Sonic Pi → MIDI rendering
Use the `render_midi` MCP tool to export a `.mid` file from an existing Sonic Pi Ruby script:
```json
{
  "name": "render_midi",
  "arguments": {
    "path": "/path/to/song.rb",
    "bars": 8,
    "output": "/tmp/song.mid"
  }
}
```
Drums are split into separate tracks (kick, snare, hats, etc.). Use `loop_names` to render specific `live_loop`s or `drum_split: false` to merge all percussion into one track.

Known limitations (planned improvements):
- Complex Ruby control flow/randomness is skipped with warnings.
- Timing is best-effort for straightforward `sleep`/`.times`; no randomness/conditionals.
- Limited chord vocabulary and drum sample map; falls back to grand piano or default drum pitch when unknown.

### Prerequisites

* Sonic Pi
* Node

### Setup

The easy way is :

```sh
claude mcp add sp-mc npx 'sp-mc@latest'
```

Start Sonic Pi then start Claude.

#### Installation

```sh
git clone https://github.com/danja/sp-mc.git
cd sp-mc
npm install
```

#### Configure MCP Connection

eg. in `~/.claude.json`:
```json
   "sonic-pi": {
     "type": "stdio",
     "command": "node",
     "args": ["/path/to/sp-mc/mcp/server.js"],
     "env": {}
   }
```

### Running in VS Code

There is a VS Code extension [vscode-sonic-pi](https://marketplace.visualstudio.com/items?itemName=jakearl.vscode-sonic-pi) which provides syntax highlighting for Sonic Pi code. With Claude Code running in a VS Code terminal you can build up songs in the editor and manage them on the file system. 

### Port Configuration Note
The MCP server automatically detects the correct port from Sonic Pi's log files. If Sonic Pi is running on a non-standard OSC port (e.g., 4560 instead of the default 4557), the server will find and use the correct port automatically by parsing `~/.sonic-pi/log/server-output.log`.

### Testing

This project includes comprehensive test coverage with vitest. Tests can run against either a mock Sonic Pi server or a real Sonic Pi installation.

**Run tests (mock mode by default):**
```bash
npm test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run tests with mock Sonic Pi server:**
```bash
npm run test:mock
```

**Run tests with real Sonic Pi (requires Sonic Pi to be running):**
```bash
npm run test:real
```

**Test Structure:**
- `mcp/log-parser.test.js` - Tests for Sonic Pi log file parsing
- `mcp/sonic-pi-client.test.js` - Tests for OSC communication with Sonic Pi
- `mcp/server.test.js` - Tests for MCP server beat patterns and validation
- `mcp/render/render.test.js` - Tests for Sonic Pi → MIDI rendering
- `mcp/render/render-roundtrip.test.js` - Round-trip timing checks (e.g., with_bpm alignment)
- `test/helpers/` - Mock Sonic Pi server and test utilities
- `test/fixtures/` - Sample log files for testing

**Note:** If you have Sonic Pi installed, some tests may use your real Sonic Pi logs for integration testing. To run pure unit tests, temporarily move `~/.sonic-pi/log/` or use Docker/CI environments.

### Documentation
See `/mcp/README.md` for detailed documentation.
