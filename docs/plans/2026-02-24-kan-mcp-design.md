# Kan MCP Server — Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

A TypeScript MCP server that exposes the Kan kanban API to Claude and other MCP-compatible clients. Runs as a stdio subprocess, reads `KAN_API_KEY` from the environment, and acts as a thin authenticated proxy to `https://kan.bn/api/v1`.

## Architecture

```
Claude Code / Claude Desktop
        │  (stdio)
        ▼
  kan-mcp-server (Node.js)
        │  (HTTPS + x-api-key header)
        ▼
   https://kan.bn/api/v1
```

No database or local persistence. The server is stateless — every tool call maps to one or more REST requests.

**Transport:** stdio (standard for MCP subprocess servers)
**Auth:** `KAN_API_KEY` environment variable, sent as `x-api-key` header on every request
**Runtime:** Node.js + TypeScript, built with `tsc`

## Tools

8 tools total, each with an `action` enum field plus resource-specific parameters.

| Tool | Actions | Notes |
|------|---------|-------|
| `workspaces` | `list`, `get`, `create`, `update`, `delete`, `search` | `search` requires `query` param |
| `boards` | `list`, `get`, `create`, `update`, `delete` | `list` requires `workspacePublicId` |
| `lists` | `create`, `update`, `delete` | No standalone get; returned with board |
| `cards` | `get`, `create`, `update`, `delete` | `create` requires `listPublicId` + `title` |
| `labels` | `get`, `create`, `update`, `delete` | `create` requires `boardPublicId` + `colourCode` |
| `card_comments` | `create`, `update`, `delete` | All require `cardPublicId` |
| `card_members` | `add`, `remove` | Toggle via PUT |
| `card_labels` | `add`, `remove` | Toggle via PUT |

## Project Structure

```
kanban/
├── src/
│   ├── index.ts              # MCP server entry point, tool registration
│   ├── client.ts             # Kan API HTTP client (fetch + auth header)
│   └── tools/
│       ├── workspaces.ts     # Workspace CRUD + search
│       ├── boards.ts         # Board CRUD
│       ├── lists.ts          # List CRUD
│       ├── cards.ts          # Card CRUD
│       ├── labels.ts         # Label CRUD
│       └── card-actions.ts   # Comments, member toggles, label toggles
├── docs/
│   └── plans/
│       └── 2026-02-24-kan-mcp-design.md
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

- HTTP 4xx errors from Kan API are surfaced as MCP tool errors with the response body message
- HTTP 5xx errors are surfaced as generic infrastructure errors
- Missing required parameters are caught before the API call and returned as validation errors
- `KAN_API_KEY` absence causes the server to exit with a clear error message on startup

## Configuration

The MCP client (e.g., Claude Desktop) configures the server in its settings:

```json
{
  "mcpServers": {
    "kan": {
      "command": "node",
      "args": ["/path/to/kanban/dist/index.js"],
      "env": {
        "KAN_API_KEY": "kan_your_key_here"
      }
    }
  }
}
```

## Out of Scope

- Attachments (presigned S3 upload flow)
- Integrations (Trello import, OAuth providers)
- Workspace invites/member management
- Card activity history
- Pagination cursor management (initial implementation returns default page)
