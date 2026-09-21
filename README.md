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

# Make changes to your code, then push
xgodo project push

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

### Push, Pull & Commit

```bash
xgodo project push           # Push local changes to server's working directory
xgodo project pull           # Pull working directory changes from server (overwrites local files)
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

## TypeScript Support

The CLI automatically downloads type definitions for your project:

- **node-types.ts** - Platform node types and interfaces
- **bootstrap.ts** - Bootstrap utilities and helpers
- **arguments.ts** - Your project's parameter and variable types

These are regenerated on each pull to stay up to date.

## Workflow

1. **Clone** your project from the server
2. **Edit** TypeScript files in your favorite editor
3. **Push** uploads your changes and compiles them on the server
4. **Commit** creates a versioned snapshot

Use **pull** to retrieve the server's working directory changes (e.g. edits made in the web editor). Compiled `.js` files are skipped when a corresponding `.ts` file exists.

The CLI automatically pushes local changes before `status`, `diff`, `commit`, and `template apply` commands.

## MCP Server

Xgodo provides an MCP (Model Context Protocol) server that enables AI assistants like Claude to manage your automation projects and control Android devices using natural language.

### Adding to Claude Code

```bash
claude mcp add --header "Authorization: Bearer YOUR_API_KEY" --transport http xgodo-dev https://xgodo.com/server/api/v2/mcp
```

Replace `YOUR_API_KEY` with your API key from the Xgodo dashboard.

### Adding to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "xgodo-dev": {
      "url": "https://xgodo.com/server/api/v2/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Available Tools

Once connected, Claude can:

**Project Management (via MCP)**

- List projects and set current context
- Read and write project files
- Apply templates
- Manage automation parameters

**Device Control (via MCP)**

- List and select your Android devices
- Take screenshots and get UI hierarchy
- Tap, swipe, type text, and press keys
- Launch apps and navigate

**Local CLI Required**

The following operations require the local Xgodo CLI (install with `npm install -g @xgodo/cli`):

- `xgodo project push` - Push local changes to server
- `xgodo project pull` - Pull changes from server
- `xgodo project commit` - Commit changes
- `xgodo project status` - View uncommitted changes
- `xgodo project log` - View commit history
- `xgodo project diff` - View diff from last commit

### Example Usage

Ask Claude:

- "List my Xgodo projects"
- "Show me the main.ts file in my automation project"
- "Search for 'latest news' on Chrome on my Extra Moose device"
- "Take a screenshot of my device"

## License

MIT
