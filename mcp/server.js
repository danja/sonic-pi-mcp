#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SonicPiClient } from './sonic-pi-client.js';
import { logDirectoryExists } from './log-parser.js';
import { renderSonicPiToMidi } from './render/index.js';

// Beat patterns (same as Python version)
const BEAT_PATTERNS = {
  blues: `
# Blues Beat
use_bpm 100
swing = 0.15  # Shuffle feel (0 for straight timing)
live_loop :blues_drums do
  sample :hat_tap, amp: 0.9
  sample :drum_bass_hard, amp: 0.9
  sleep 0.5+swing
  sample :hat_tap, amp: 0.7
  sample :drum_bass_hard, amp: 0.8
  sleep 0.5-swing
  sample :drum_snare_hard, amp: 0.8
  sample :hat_tap, amp: 0.8
  sleep 0.5+swing
  sample :hat_tap, amp: 0.7
  sleep 0.5-swing
end
`,
  rock: `
# Rock Beat
use_bpm 120
live_loop :rock_drums do
  sample :drum_bass_hard, amp: 1
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_snare_hard, amp: 0.9
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
end
`,
  hiphop: `
# Hip-Hop Beat
use_bpm 90
live_loop :hip_hop_drums do
  sample :drum_bass_hard, amp: 1.2
  sleep 1
  sample :drum_snare_hard, amp: 0.9
  sleep 1
  sample :drum_bass_hard, amp: 1.2
  sleep 0.5
  sample :drum_bass_hard, amp: 0.8
  sleep 0.5
  sample :drum_snare_hard, amp: 0.9
  sleep 1
end
`,
  electronic: `
# Electronic Beat
use_bpm 128
live_loop :electronic_beat do
  sample :bd_haus, amp: 1
  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :bd_haus, amp: 0.9
  sample :drum_snare_hard, amp: 0.8
  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5
end
`,
};

const SYSTEM_PROMPT = `
You are a Sonic Pi assistant that helps users create musical compositions using code. Your knowledge includes various rhythm patterns, chord progressions, scales, and proper Sonic Pi syntax. Respond with accurate, executable Sonic Pi code based on user requests. Remember to call initialize_sonic_pi first before playing any music with Sonic Pi.

When the user asks you to play a beat, you should use the get_beat_pattern tool to get the beat pattern, play the beat and add nothing else on top of it.

When the user asks you to play a chord progression, construct one using the following chord format, and add it to the existing beat.

Chords have the following format: chord  tonic (symbol), name (symbol)

Here's an example chord with C tonic and various names:
(chord :C, '1')
(chord :C, '5')
(chord :C, '+5')
(chord :C, 'm+5')
(chord :C, :sus2)
(chord :C, :sus4)
(chord :C, '6')
(chord :C, :m6)
(chord :C, '7sus2')
(chord :C, '7sus4')
(chord :C, '7-5')
(chord :C, 'm7-5')
(chord :C, '7+5')
(chord :C, 'm7+5')
(chord :C, '9')
(chord :C, :m9)
(chord :C, 'm7+9')
(chord :C, :maj9)
(chord :C, '9sus4')
(chord :C, '6*9')
(chord :C, 'm6*9')
(chord :C, '7-9')
(chord :C, 'm7-9')
(chord :C, '7-10')
(chord :C, '9+5')
(chord :C, 'm9+5')
(chord :C, '7+5-9')
(chord :C, 'm7+5-9')
(chord :C, '11')
(chord :C, :m11)
(chord :C, :maj11)
(chord :C, '11+')
(chord :C, 'm11+')
(chord :C, '13')
(chord :C, :m13)
(chord :C, :add2)
(chord :C, :add4)
(chord :C, :add9)
(chord :C, :add11)
(chord :C, :add13)
(chord :C, :madd2)
(chord :C, :madd4)
(chord :C, :madd9)
(chord :C, :madd11)
(chord :C, :madd13)
(chord :C, :major)
(chord :C, :M)
(chord :C, :minor)
(chord :C, :m)
(chord :C, :major7)
(chord :C, :dom7)
(chord :C, '7')
(chord :C, :M7)
(chord :C, :minor7)
(chord :C, :m7)
(chord :C, :augmented)
(chord :C, :a)
(chord :C, :diminished)
(chord :C, :dim)
(chord :C, :i)
(chord :C, :diminished7)
(chord :C, :dim7)
(chord :C, :i7)

Remember that all Sonic Pi code must be valid Ruby code, with proper indentation, parameter passing, and loop definitions. When composing patterns, always ensure the timing adds up correctly within each loop.
`;

// Create Sonic Pi client instance
const sonicPiClient = new SonicPiClient();

// Create MCP server
const server = new Server(
  {
    name: 'sonic-pi-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'initialize_sonic_pi',
        description: 'Initialize the Sonic Pi server',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'play_music',
        description: 'Play music using Sonic Pi code',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Sonic Pi Ruby code to execute',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'stop_music',
        description: 'Stop all currently playing Sonic Pi music',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_beat_pattern',
        description: 'Get drum beat patterns for Sonic Pi',
        inputSchema: {
          type: 'object',
          properties: {
            style: {
              type: 'string',
              description: 'Beat style (blues, rock, jazz, hiphop, electronic)',
            },
          },
          required: ['style'],
        },
      },
      {
        name: 'make_acid',
        description: 'Create a classic acid house track with TB-303 style bassline',
        inputSchema: {
          type: 'object',
          properties: {
            bpm: {
              type: 'number',
              description: 'BPM (default: 128)',
            },
            key: {
              type: 'string',
              description: 'Musical key (default: e)',
            },
          },
        },
      },
      {
        name: 'render_midi',
        description:
          'Read a Sonic Pi .rb file and render it as a .mid file with separate tracks per instrument (drums split by instrument)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to Sonic Pi Ruby file' },
            bars: { type: 'number', description: 'Number of bars to unroll (default 8)' },
            output: { type: 'string', description: 'Optional output .mid path' },
            loop_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of live_loop names to include',
            },
            drum_split: {
              type: 'boolean',
              description: 'Whether to split drum instruments into separate tracks (default true)',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'system_prompt',
        description: 'Get the Sonic Pi assistant system prompt',
      },
    ],
  };
});

// Get prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'system_prompt') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: SYSTEM_PROMPT,
          },
        },
      ],
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'initialize_sonic_pi': {
        if (!logDirectoryExists()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Sonic Pi does not appear to be running. Please start Sonic Pi first.',
              },
            ],
          };
        }

        const result = await sonicPiClient.initialize();
        return {
          content: [
            {
              type: 'text',
              text: result.startsWith('Error') ? result : `${result}\n\n${SYSTEM_PROMPT}`,
            },
          ],
        };
      }

      case 'play_music': {
        if (!logDirectoryExists()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Sonic Pi does not appear to be running. Please start Sonic Pi first.',
              },
            ],
          };
        }

        // Stop current playback first
        await sonicPiClient.stop();

        // Run the new code
        const result = await sonicPiClient.runCode(args.code);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'stop_music': {
        if (!logDirectoryExists()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Sonic Pi does not appear to be running. Please start Sonic Pi first.',
              },
            ],
          };
        }

        const result = await sonicPiClient.stop();
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_beat_pattern': {
        const style = args.style.toLowerCase();
        if (BEAT_PATTERNS[style]) {
          return {
            content: [
              {
                type: 'text',
                text: BEAT_PATTERNS[style],
              },
            ],
          };
        } else {
          const availableStyles = Object.keys(BEAT_PATTERNS).join(', ');
          return {
            content: [
              {
                type: 'text',
                text: `Beat style '${args.style}' not found. Available styles: ${availableStyles}`,
              },
            ],
          };
        }
      }

      case 'make_acid': {
        const bpm = args.bpm || 128;
        const key = args.key || 'e';

        const acidCode = `# Classic Acid House Track
use_bpm ${bpm}

live_loop :acid_kick do
  sample :bd_haus, amp: 1.5
  sleep 1
end

live_loop :acid_hats do
  sample :drum_cymbal_closed, amp: 0.6
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.4
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.6
  sleep 0.25
  sample :drum_cymbal_closed, amp: 0.5
  sleep 0.25

  if one_in(4)
    sample :drum_cymbal_open, amp: 0.5, release: 0.3
  end
end

live_loop :acid_bass do
  use_synth :tb303
  use_synth_defaults release: 0.2, cutoff: 70, res: 0.8, wave: 1

  notes = (scale :${key}2, :minor_pentatonic, num_octaves: 2)

  16.times do
    cutoff_val = rrand(60, 120)
    res_val = rrand(0.7, 0.95)

    use_synth_defaults release: 0.15, cutoff: cutoff_val, res: res_val, wave: 1

    play notes.choose, amp: 0.8
    sleep 0.25
  end
end

live_loop :acid_clap do
  sleep 1
  sample :drum_snare_hard, amp: 0.7
  sleep 1
end`;

        return {
          content: [
            {
              type: 'text',
              text: acidCode,
            },
          ],
        };
      }

      case 'render_midi': {
        const result = renderSonicPiToMidi({
          filePath: args.path,
          bars: args.bars,
          output: args.output,
          loopNames: args.loop_names,
          drumSplit: args.drum_split !== false,
        });

        const summary = `MIDI written to ${result.midiPath}
Tracks: ${result.tracks
          .map(
            (t) =>
              `${t.name} (channel ${t.channel + 1}${t.isPercussion ? ', drums' : ''}, program ${t.instrumentNumber})`
          )
          .join('; ')}
Events: ${result.eventCount}
Warnings: ${result.warnings.length ? result.warnings.join(' | ') : 'none'}`;

        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Sonic Pi MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
