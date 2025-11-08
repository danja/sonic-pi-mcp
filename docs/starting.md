Package `sonic-pi` is in Ubuntu.

https://github.com/vinayak-mehta/mcp-sonic-pi

needed `uv`, https://github.com/astral-sh/uv

claude mcp add playwright npx '@playwright/mcp@latest'

claude mcp add sonic-pi uvx mcp-sonic-pi

Added stdio MCP server sonic-pi with command: uvx mcp-sonic-pi to local config
File modified: /home/danny/.claude.json [project: /home/danny/github/sp]

in VS Code, Claude, /mcp

Tools for sonic-pi (4 tools)                                                                                                                                                   initialize_sonic_pi                                                                                                                                      play_music
stop_music                                                                                                                                               get_beat_pattern   

create a file src/hip.sp and use sonic-pi mcp to initialise sonic-pi then get_beat_pattern something in a hip hop style, put that in the file, then play it 

1. In Sonic Pi: Go to Preferences/Settings and verify that:
    - "Enable OSC server" is checked
    - The port is set to 4557 (default)
  2. Check if Sonic Pi is listening: You could run this to see if port 4557 is open:
  netstat -ln | grep 4557
  3. The MCP server configuration might need the correct host/port settings for your Sonic Pi instance.

/home/danny/.claude.json 


  "/home/danny/github/sp": {
      "allowedTools": [],
      "mcpContextUris": [],
      "mcpServers": {
        "sonic-pi": {
          "type": "stdio",
          "command": "uvx",
          "args": [
            "mcp-sonic-pi"
          ],
          "env": {
            "SONIC_PI_PORT": "4560"
          }
        }

nope, it's not supported

4559 port is changed to 4560

https://in-thread.sonic-pi.net/t/changing-osc-listening-port/3082/3

hardwired in psonic lib, seem to have version incompatibility with what I got from Ubuntu repo.

  "sonic-pi": {
    "type": "stdio",
    "command": "node",
    "args": [
      "/home/danny/github/sp/mcp/server.js"
    ],
    "env": {}
  }