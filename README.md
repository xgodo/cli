# @xgodo/cli

Command-line interface for the Xgodo automation platform. Clone, sync, and manage your automation projects from the terminal.

## Installation

```bash
npm install -g @xgodo/cli
```

Requires Node.js 18 or later.

## Quick Start

```bash
# Login with your API key
xgodo login

# List your projects
xgodo project list

# Clone a project
xgodo project clone

# Make changes to your code, then sync
xgodo project sync

# Commit your changes
xgodo project commit -m "Add new automation"
```

## Commands

### Authentication

```bash
xgodo login                  # Login with API key (interactive)
xgodo login -k <key>         # Login with API key directly
xgodo logout                 # Clear stored credentials
xgodo whoami                 # Show current user
```

### Project Management

```bash
xgodo project list           # List all projects (alias: xgodo p ls)
xgodo project clone          # Clone a project interactively
xgodo project clone <id>     # Clone a specific project
xgodo project clone -p ./dir # Clone to a specific directory
```

### Sync & Commit

```bash
xgodo project sync           # Sync local changes with server
xgodo project commit         # Commit changes (prompts for message)
xgodo project commit -m "message"  # Commit with message
xgodo project commit -f      # Commit with default message
```

### Version Control

```bash
xgodo project status         # Show uncommitted changes
xgodo project log            # Show commit history
xgodo project log -n 10      # Show last 10 commits
xgodo project diff           # Show diff from last commit
xgodo project diff -f main.ts  # Show diff for specific file
```

### Templates

```bash
xgodo project template list  # List available templates (alias: xgodo p t ls)
xgodo project template apply # Apply a template interactively
xgodo project template apply <id>  # Apply a specific template
```

### Arguments

Manage automation parameters and job variables:

```bash
xgodo project arguments list  # List parameters and variables (alias: xgodo p args ls)
xgodo project arguments edit  # Interactive editor for parameters
```

### Shell Completions

```bash
xgodo completion install     # Install shell completions (bash, zsh, fish)
xgodo completion uninstall   # Remove shell completions
```

## Project Structure

When you clone a project, the CLI creates:

```
my-project/
├── .xgodo/           # Project metadata (gitignored)
│   ├── project.json  # Project info
│   └── hashes.json   # File sync state
├── types/            # TypeScript definitions (gitignored)
│   ├── node-types.ts
│   ├── bootstrap.ts
│   └── arguments.ts
├── main.ts           # Your automation code
├── tsconfig.json     # TypeScript config
└── .gitignore
```

## TypeScript Support

The CLI automatically downloads type definitions for your project:

- **node-types.ts** - Platform node types and interfaces
- **bootstrap.ts** - Bootstrap utilities and helpers
- **arguments.ts** - Your project's parameter and variable types

These are regenerated on each sync to stay up to date.

## Workflow

1. **Clone** your project from the server
2. **Edit** TypeScript files in your favorite editor
3. **Sync** uploads your changes and compiles them on the server
4. **Commit** creates a versioned snapshot

The CLI automatically syncs before `status`, `diff`, `commit`, and `template apply` commands.

## Configuration

Credentials are stored in `~/.config/xgodo/config.json`.

Project metadata is stored in `.xgodo/` within each project directory.

### Custom API URL

```bash
xgodo login -u https://your-server.com/server
```

## MCP Server

Xgodo provides an MCP (Model Context Protocol) server that enables AI assistants like Claude to manage your automation projects and control Android devices using natural language.

### Adding to Claude Code

```bash
claude mcp add xgodo-dev https://xgodo.com/server/api/v2/mcp --transport http-stream
```

When prompted for headers, add your API key:

```
Authorization: Bearer YOUR_API_KEY
```

You can get your API key from the Xgodo dashboard.

### Adding to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "xgodo-dev": {
      "url": "https://xgodo.com/server/api/v2/mcp",
      "transport": "http-stream",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Available Tools

Once connected, Claude can:

**Project Management**
- List, read, and write project files
- Sync changes and commit with messages
- View project status, history, and diffs
- Apply templates

**Device Control**
- List and select your Android devices
- Take screenshots and get UI hierarchy
- Tap, swipe, type text, and press keys
- Launch apps and navigate

### Example Usage

Ask Claude:

- "List my Xgodo projects"
- "Show me the main.ts file in my automation project"
- "Search for 'latest news' on Chrome on my Extra Moose device"
- "Take a screenshot of my device"

## License

MIT
