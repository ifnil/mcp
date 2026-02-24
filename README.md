# kan-mcp-server

MCP server for the [Kan](https://kan.bn) kanban API. Exposes boards, cards, lists, labels, and workspaces as Claude tools over stdio.

## Prerequisites

- Node.js 22+
- A Kan account with an API key (generate at https://kan.bn → Account Settings)

## Setup

```bash
npm install
npm run build
```

## Tools

| Tool | Actions |
|------|---------|
| `workspaces` | list, get, create, update, delete, search |
| `boards` | list, get, create, update, delete |
| `lists` | create, update, delete |
| `cards` | get, create, update, delete |
| `labels` | get, create, update, delete |
| `card_comments` | create, update, delete |
| `card_members` | add, remove |
| `card_labels` | add, remove |

## Configuration

### Claude Code

Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "kan": {
      "command": "node",
      "args": ["/absolute/path/to/kanban/dist/index.js"],
      "env": {
        "KAN_API_KEY": "kan_your_key_here",
        "KAN_DEBUG": "1"
      }
    }
  }
}
```

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kan": {
      "command": "node",
      "args": ["/absolute/path/to/kanban/dist/index.js"],
      "env": {
        "KAN_API_KEY": "kan_your_key_here",
        "KAN_DEBUG": "1"
      }
    }
  }
}
```

## Development

```bash
npm test          # run all tests
npm run typecheck # TypeScript type-check without emitting
```

Set `KAN_DEBUG=1` to emit request/response debug logs to stderr.
