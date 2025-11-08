# sp
sonic-pi play

## Sonic Pi MCP Server

This repository includes a Node.js MCP (Model Context Protocol) server for controlling Sonic Pi via OSC.

### Location
- MCP server code: `/mcp/`
- Example file: `src/hip.rb` (hip hop beat)

### Features
- Direct OSC communication with Sonic Pi (no psonic dependency)
- Supports both Sonic Pi v3.x and v4.x
- Automatic port detection from Sonic Pi log files
- Includes beat patterns for blues, rock, hip-hop, and electronic music

### Setup
1. Install dependencies:
   ```bash
   cd mcp
   npm install
   ```

2. Configure in `~/.claude.json`:
   ```json
   "sonic-pi": {
     "type": "stdio",
     "command": "node",
     "args": ["/home/danny/github/sp/mcp/server.js"],
     "env": {}
   }
   ```

3. Restart Claude Code

### Port Configuration Note
The MCP server automatically detects the correct port from Sonic Pi's log files. If Sonic Pi is running on a non-standard OSC port (e.g., 4560 instead of the default 4557), the server will find and use the correct port automatically by parsing `~/.sonic-pi/log/server-output.log`.

### Documentation
See `/mcp/README.md` for detailed documentation.
