# Kan MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript MCP server that exposes the Kan kanban API as 8 resource-grouped tools for use in Claude Code and Claude Desktop.

**Architecture:** Stdio MCP server using `@modelcontextprotocol/sdk`. A `KanClient` class wraps all HTTP calls with `x-api-key` auth. Each resource (workspaces, boards, etc.) has a dedicated tool file exporting a pure handler function (for testability) and a registration function wired into the MCP server.

**Tech Stack:** TypeScript 5.9, Node.js 22+, `@modelcontextprotocol/sdk` ^1.27.0, `zod` ^4.3.0, `vitest` ^4.0.0

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

**Step 1: Create `package.json`**

```json
{
  "name": "kan-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for the Kan kanban API",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "kan-mcp-server": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.0",
    "zod": "^4.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors

**Step 5: Verify TypeScript is happy**

Run: `npx tsc --version`
Expected: TypeScript version printed

**Step 6: Commit**

```bash
git init
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: project scaffold for Kan MCP server"
```

---

## Task 2: Kan API Client

**Files:**
- Create: `src/client.ts`
- Create: `src/client.test.ts`

**Step 1: Write failing test — `src/client.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanClient } from "./client.js";

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h: string) => (h === "content-type" ? contentType : null) },
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
  );
}

describe("KanClient", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("sends x-api-key header on GET", async () => {
    mockFetch(200, { workspaces: [] });
    const client = new KanClient("test-key-123");
    await client.get("/workspaces");
    expect(fetch).toHaveBeenCalledWith(
      "https://kan.bn/api/v1/workspaces",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-api-key": "test-key-123" }),
      })
    );
  });

  it("sends JSON body and Content-Type on POST", async () => {
    mockFetch(200, { publicId: "board_123" });
    const client = new KanClient("key");
    await client.post("/boards", { name: "My Board" });
    expect(fetch).toHaveBeenCalledWith(
      "https://kan.bn/api/v1/boards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My Board" }),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("throws on 4xx with status in message", async () => {
    mockFetch(404, { message: "Not found" });
    const client = new KanClient("key");
    await expect(client.get("/boards/bad")).rejects.toThrow("Kan API 404");
  });

  it("throws on 5xx with status in message", async () => {
    mockFetch(500, { message: "Internal error" });
    const client = new KanClient("key");
    await expect(client.get("/workspaces")).rejects.toThrow("Kan API 500");
  });

  it("returns parsed JSON body on success", async () => {
    mockFetch(200, [{ publicId: "ws_1", name: "My Workspace" }]);
    const client = new KanClient("key");
    const result = await client.get<{ publicId: string; name: string }[]>("/workspaces");
    expect(result).toEqual([{ publicId: "ws_1", name: "My Workspace" }]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `KanClient` not found

**Step 3: Implement `src/client.ts`**

```typescript
const BASE_URL = "https://kan.bn/api/v1";

export class KanClient {
  constructor(private apiKey: string) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Kan API ${response.status}: ${text}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: true } as T;
    }
    return response.json() as Promise<T>;
  }

  get<T>(path: string) { return this.request<T>("GET", path); }
  post<T>(path: string, body: unknown) { return this.request<T>("POST", path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>("PUT", path, body); }
  delete<T>(path: string) { return this.request<T>("DELETE", path); }
}
```

**Step 4: Run test to verify pass**

Run: `npm test`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add src/client.ts src/client.test.ts
git commit -m "feat: Kan API HTTP client with auth header"
```

---

## Task 3: Workspaces Tool

**Files:**
- Create: `src/tools/workspaces.ts`
- Create: `src/tools/workspaces.test.ts`

**Step 1: Write failing test — `src/tools/workspaces.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { workspacesHandler } from "./workspaces.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("workspacesHandler", () => {
  it("list — calls GET /workspaces", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "list" });
    expect(client.get).toHaveBeenCalledWith("/workspaces");
  });

  it("get — calls GET /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "get", workspacePublicId: "ws_1" });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1");
  });

  it("get — throws without workspacePublicId", async () => {
    const client = makeClient();
    await expect(workspacesHandler(client, { action: "get" })).rejects.toThrow("workspacePublicId");
  });

  it("create — calls POST /workspaces with name", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "create", name: "Dev" });
    expect(client.post).toHaveBeenCalledWith("/workspaces", { name: "Dev" });
  });

  it("create — includes slug when provided", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "create", name: "Dev", slug: "dev" });
    expect(client.post).toHaveBeenCalledWith("/workspaces", { name: "Dev", slug: "dev" });
  });

  it("create — throws without name", async () => {
    const client = makeClient();
    await expect(workspacesHandler(client, { action: "create" })).rejects.toThrow("name");
  });

  it("update — calls PUT /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "update", workspacePublicId: "ws_1", name: "New" });
    expect(client.put).toHaveBeenCalledWith("/workspaces/ws_1", expect.objectContaining({ name: "New" }));
  });

  it("delete — calls DELETE /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "delete", workspacePublicId: "ws_1" });
    expect(client.delete).toHaveBeenCalledWith("/workspaces/ws_1");
  });

  it("search — calls GET with query param", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "search", workspacePublicId: "ws_1", query: "task" });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1/search?query=task");
  });

  it("search — includes limit when provided", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "search", workspacePublicId: "ws_1", query: "bug", limit: 5 });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1/search?query=bug&limit=5");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `workspacesHandler` not found

**Step 3: Implement `src/tools/workspaces.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

type WorkspacesParams = {
  action: "list" | "get" | "create" | "update" | "delete" | "search";
  workspacePublicId?: string;
  name?: string;
  slug?: string;
  description?: string;
  query?: string;
  limit?: number;
};

export async function workspacesHandler(client: KanClient, params: WorkspacesParams): Promise<unknown> {
  switch (params.action) {
    case "list":
      return client.get("/workspaces");
    case "get":
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for get");
      return client.get(`/workspaces/${params.workspacePublicId}`);
    case "create":
      if (!params.name) throw new Error("name required for create");
      return client.post("/workspaces", {
        name: params.name,
        ...(params.slug ? { slug: params.slug } : {}),
      });
    case "update":
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for update");
      return client.put(`/workspaces/${params.workspacePublicId}`, {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.slug !== undefined ? { slug: params.slug } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
      });
    case "delete":
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for delete");
      return client.delete(`/workspaces/${params.workspacePublicId}`);
    case "search": {
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for search");
      if (!params.query) throw new Error("query required for search");
      const qs = new URLSearchParams({ query: params.query });
      if (params.limit !== undefined) qs.set("limit", String(params.limit));
      return client.get(`/workspaces/${params.workspacePublicId}/search?${qs}`);
    }
  }
}

export function registerWorkspacesTool(server: McpServer, client: KanClient): void {
  server.tool(
    "workspaces",
    "Manage Kan workspaces: list all, get one, create, update, delete, or search boards/cards within a workspace.",
    {
      action: z.enum(["list", "get", "create", "update", "delete", "search"]).describe("Operation to perform"),
      workspacePublicId: z.string().optional().describe("Workspace ID (required for get, update, delete, search)"),
      name: z.string().min(1).max(64).optional().describe("Workspace name (required for create)"),
      slug: z.string().min(3).max(64).optional().describe("URL-safe workspace slug"),
      description: z.string().optional().describe("Workspace description (for update)"),
      query: z.string().min(1).max(100).optional().describe("Search query text (required for search)"),
      limit: z.number().int().min(1).max(50).optional().describe("Max search results (1-50)"),
    },
    async (params) => {
      const result = await workspacesHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 4: Run test to verify pass**

Run: `npm test`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add src/tools/workspaces.ts src/tools/workspaces.test.ts
git commit -m "feat: workspaces tool"
```

---

## Task 4: Boards Tool

**Files:**
- Create: `src/tools/boards.ts`
- Create: `src/tools/boards.test.ts`

**Step 1: Write failing test — `src/tools/boards.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { boardsHandler } from "./boards.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("boardsHandler", () => {
  it("list — calls GET /workspaces/:id/boards", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "list", workspacePublicId: "ws_1" });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1/boards");
  });

  it("list — throws without workspacePublicId", async () => {
    const client = makeClient();
    await expect(boardsHandler(client, { action: "list" })).rejects.toThrow("workspacePublicId");
  });

  it("get — calls GET /boards/:id", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "get", boardPublicId: "bd_1" });
    expect(client.get).toHaveBeenCalledWith("/boards/bd_1");
  });

  it("create — calls POST /workspaces/:id/boards", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "create", workspacePublicId: "ws_1", name: "Backlog" });
    expect(client.post).toHaveBeenCalledWith("/workspaces/ws_1/boards", { name: "Backlog" });
  });

  it("update — calls PUT /boards/:id", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "update", boardPublicId: "bd_1", name: "New Name" });
    expect(client.put).toHaveBeenCalledWith("/boards/bd_1", expect.objectContaining({ name: "New Name" }));
  });

  it("update — includes favorite when provided", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "update", boardPublicId: "bd_1", favorite: true });
    expect(client.put).toHaveBeenCalledWith("/boards/bd_1", expect.objectContaining({ favorite: true }));
  });

  it("delete — calls DELETE /boards/:id", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "delete", boardPublicId: "bd_1" });
    expect(client.delete).toHaveBeenCalledWith("/boards/bd_1");
  });
});
```

**Step 2: Run to verify fail, then implement `src/tools/boards.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

type BoardsParams = {
  action: "list" | "get" | "create" | "update" | "delete";
  workspacePublicId?: string;
  boardPublicId?: string;
  name?: string;
  slug?: string;
  visibility?: "public" | "private";
  favorite?: boolean;
};

export async function boardsHandler(client: KanClient, params: BoardsParams): Promise<unknown> {
  switch (params.action) {
    case "list":
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for list");
      return client.get(`/workspaces/${params.workspacePublicId}/boards`);
    case "get":
      if (!params.boardPublicId) throw new Error("boardPublicId required for get");
      return client.get(`/boards/${params.boardPublicId}`);
    case "create":
      if (!params.workspacePublicId) throw new Error("workspacePublicId required for create");
      if (!params.name) throw new Error("name required for create");
      return client.post(`/workspaces/${params.workspacePublicId}/boards`, { name: params.name });
    case "update":
      if (!params.boardPublicId) throw new Error("boardPublicId required for update");
      return client.put(`/boards/${params.boardPublicId}`, {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.slug !== undefined ? { slug: params.slug } : {}),
        ...(params.visibility !== undefined ? { visibility: params.visibility } : {}),
        ...(params.favorite !== undefined ? { favorite: params.favorite } : {}),
      });
    case "delete":
      if (!params.boardPublicId) throw new Error("boardPublicId required for delete");
      return client.delete(`/boards/${params.boardPublicId}`);
  }
}

export function registerBoardsTool(server: McpServer, client: KanClient): void {
  server.tool(
    "boards",
    "Manage Kan boards: list workspace boards, get, create, update (name/slug/visibility/favorite), or delete.",
    {
      action: z.enum(["list", "get", "create", "update", "delete"]).describe("Operation to perform"),
      workspacePublicId: z.string().optional().describe("Workspace ID (required for list, create)"),
      boardPublicId: z.string().optional().describe("Board ID (required for get, update, delete)"),
      name: z.string().min(1).max(100).optional().describe("Board name (required for create)"),
      slug: z.string().optional().describe("Board slug (for update)"),
      visibility: z.enum(["public", "private"]).optional().describe("Board visibility (for update)"),
      favorite: z.boolean().optional().describe("Favorite status (for update)"),
    },
    async (params) => {
      const result = await boardsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 3: Run test to verify pass, then commit**

Run: `npm test`

```bash
git add src/tools/boards.ts src/tools/boards.test.ts
git commit -m "feat: boards tool"
```

---

## Task 5: Lists Tool

**Files:**
- Create: `src/tools/lists.ts`
- Create: `src/tools/lists.test.ts`

**Step 1: Write failing test — `src/tools/lists.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { listsHandler } from "./lists.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("listsHandler", () => {
  it("create — calls POST /lists", async () => {
    const client = makeClient();
    await listsHandler(client, { action: "create", boardPublicId: "bd_1", name: "To Do" });
    expect(client.post).toHaveBeenCalledWith("/lists", { name: "To Do", boardPublicId: "bd_1" });
  });

  it("create — throws without boardPublicId", async () => {
    const client = makeClient();
    await expect(listsHandler(client, { action: "create", name: "To Do" })).rejects.toThrow("boardPublicId");
  });

  it("create — throws without name", async () => {
    const client = makeClient();
    await expect(listsHandler(client, { action: "create", boardPublicId: "bd_1" })).rejects.toThrow("name");
  });

  it("update — calls PUT /lists/:id with name", async () => {
    const client = makeClient();
    await listsHandler(client, { action: "update", listPublicId: "lst_1", name: "Done" });
    expect(client.put).toHaveBeenCalledWith("/lists/lst_1", expect.objectContaining({ name: "Done" }));
  });

  it("update — includes index when provided", async () => {
    const client = makeClient();
    await listsHandler(client, { action: "update", listPublicId: "lst_1", index: 2 });
    expect(client.put).toHaveBeenCalledWith("/lists/lst_1", expect.objectContaining({ index: 2 }));
  });

  it("delete — calls DELETE /lists/:id", async () => {
    const client = makeClient();
    await listsHandler(client, { action: "delete", listPublicId: "lst_1" });
    expect(client.delete).toHaveBeenCalledWith("/lists/lst_1");
  });
});
```

**Step 2: Run to verify fail, then implement `src/tools/lists.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

type ListsParams = {
  action: "create" | "update" | "delete";
  listPublicId?: string;
  boardPublicId?: string;
  name?: string;
  index?: number;
};

export async function listsHandler(client: KanClient, params: ListsParams): Promise<unknown> {
  switch (params.action) {
    case "create":
      if (!params.boardPublicId) throw new Error("boardPublicId required for create");
      if (!params.name) throw new Error("name required for create");
      return client.post("/lists", { name: params.name, boardPublicId: params.boardPublicId });
    case "update":
      if (!params.listPublicId) throw new Error("listPublicId required for update");
      return client.put(`/lists/${params.listPublicId}`, {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.index !== undefined ? { index: params.index } : {}),
      });
    case "delete":
      if (!params.listPublicId) throw new Error("listPublicId required for delete");
      return client.delete(`/lists/${params.listPublicId}`);
  }
}

export function registerListsTool(server: McpServer, client: KanClient): void {
  server.tool(
    "lists",
    "Manage Kan lists within a board: create, rename/reorder (update), or delete.",
    {
      action: z.enum(["create", "update", "delete"]).describe("Operation to perform"),
      listPublicId: z.string().optional().describe("List ID (required for update, delete)"),
      boardPublicId: z.string().optional().describe("Board ID (required for create)"),
      name: z.string().min(1).optional().describe("List name"),
      index: z.number().int().min(0).optional().describe("List position index (for reordering)"),
    },
    async (params) => {
      const result = await listsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 3: Run test to verify pass, then commit**

Run: `npm test`

```bash
git add src/tools/lists.ts src/tools/lists.test.ts
git commit -m "feat: lists tool"
```

---

## Task 6: Cards Tool

**Files:**
- Create: `src/tools/cards.ts`
- Create: `src/tools/cards.test.ts`

**Step 1: Write failing test — `src/tools/cards.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { cardsHandler } from "./cards.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("cardsHandler", () => {
  it("get — calls GET /cards/:id", async () => {
    const client = makeClient();
    await cardsHandler(client, { action: "get", cardPublicId: "card_1" });
    expect(client.get).toHaveBeenCalledWith("/cards/card_1");
  });

  it("create — calls POST /cards with title and listPublicId", async () => {
    const client = makeClient();
    await cardsHandler(client, { action: "create", listPublicId: "lst_1", title: "Fix bug" });
    expect(client.post).toHaveBeenCalledWith("/cards", expect.objectContaining({
      title: "Fix bug",
      listPublicId: "lst_1",
    }));
  });

  it("create — includes all optional fields when provided", async () => {
    const client = makeClient();
    await cardsHandler(client, {
      action: "create",
      listPublicId: "lst_1",
      title: "Fix bug",
      description: "Details here",
      position: "start",
      dueDate: "2026-03-01",
    });
    expect(client.post).toHaveBeenCalledWith("/cards", {
      title: "Fix bug",
      listPublicId: "lst_1",
      description: "Details here",
      position: "start",
      dueDate: "2026-03-01",
    });
  });

  it("create — throws without listPublicId", async () => {
    const client = makeClient();
    await expect(cardsHandler(client, { action: "create", title: "Fix bug" })).rejects.toThrow("listPublicId");
  });

  it("create — throws without title", async () => {
    const client = makeClient();
    await expect(cardsHandler(client, { action: "create", listPublicId: "lst_1" })).rejects.toThrow("title");
  });

  it("update — calls PUT /cards/:id", async () => {
    const client = makeClient();
    await cardsHandler(client, { action: "update", cardPublicId: "card_1", title: "Updated" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1", expect.objectContaining({ title: "Updated" }));
  });

  it("update — can move card to different list", async () => {
    const client = makeClient();
    await cardsHandler(client, { action: "update", cardPublicId: "card_1", listPublicId: "lst_2" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1", expect.objectContaining({ listPublicId: "lst_2" }));
  });

  it("delete — calls DELETE /cards/:id", async () => {
    const client = makeClient();
    await cardsHandler(client, { action: "delete", cardPublicId: "card_1" });
    expect(client.delete).toHaveBeenCalledWith("/cards/card_1");
  });
});
```

**Step 2: Run to verify fail, then implement `src/tools/cards.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

type CardsParams = {
  action: "get" | "create" | "update" | "delete";
  cardPublicId?: string;
  listPublicId?: string;
  title?: string;
  description?: string;
  position?: "start" | "end";
  dueDate?: string;
  index?: number;
};

export async function cardsHandler(client: KanClient, params: CardsParams): Promise<unknown> {
  switch (params.action) {
    case "get":
      if (!params.cardPublicId) throw new Error("cardPublicId required for get");
      return client.get(`/cards/${params.cardPublicId}`);
    case "create":
      if (!params.listPublicId) throw new Error("listPublicId required for create");
      if (!params.title) throw new Error("title required for create");
      return client.post("/cards", {
        title: params.title,
        listPublicId: params.listPublicId,
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.position !== undefined ? { position: params.position } : {}),
        ...(params.dueDate !== undefined ? { dueDate: params.dueDate } : {}),
      });
    case "update":
      if (!params.cardPublicId) throw new Error("cardPublicId required for update");
      return client.put(`/cards/${params.cardPublicId}`, {
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.listPublicId !== undefined ? { listPublicId: params.listPublicId } : {}),
        ...(params.index !== undefined ? { index: params.index } : {}),
        ...(params.dueDate !== undefined ? { dueDate: params.dueDate } : {}),
      });
    case "delete":
      if (!params.cardPublicId) throw new Error("cardPublicId required for delete");
      return client.delete(`/cards/${params.cardPublicId}`);
  }
}

export function registerCardsTool(server: McpServer, client: KanClient): void {
  server.tool(
    "cards",
    "Manage Kan cards: get, create (in a list), update (title/description/list/position/due date), or delete.",
    {
      action: z.enum(["get", "create", "update", "delete"]).describe("Operation to perform"),
      cardPublicId: z.string().optional().describe("Card ID (required for get, update, delete)"),
      listPublicId: z.string().optional().describe("List ID (required for create; use in update to move card between lists)"),
      title: z.string().min(1).max(2000).optional().describe("Card title (required for create)"),
      description: z.string().max(10000).optional().describe("Card description (markdown supported)"),
      position: z.enum(["start", "end"]).optional().describe("Where to insert card in list (default: end)"),
      dueDate: z.string().optional().describe("Due date in ISO 8601 format e.g. 2026-03-15"),
      index: z.number().int().min(0).optional().describe("Card position index within list"),
    },
    async (params) => {
      const result = await cardsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 3: Run test to verify pass, then commit**

Run: `npm test`

```bash
git add src/tools/cards.ts src/tools/cards.test.ts
git commit -m "feat: cards tool"
```

---

## Task 7: Labels Tool

**Files:**
- Create: `src/tools/labels.ts`
- Create: `src/tools/labels.test.ts`

**Step 1: Write failing test — `src/tools/labels.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { labelsHandler } from "./labels.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("labelsHandler", () => {
  it("get — calls GET /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "get", labelPublicId: "lbl_1" });
    expect(client.get).toHaveBeenCalledWith("/labels/lbl_1");
  });

  it("create — calls POST /labels", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "create", boardPublicId: "bd_1", name: "Bug", colourCode: "#ff0000" });
    expect(client.post).toHaveBeenCalledWith("/labels", {
      name: "Bug",
      boardPublicId: "bd_1",
      colourCode: "#ff0000",
    });
  });

  it("create — throws without boardPublicId", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", name: "Bug", colourCode: "#ff0000" })).rejects.toThrow("boardPublicId");
  });

  it("create — throws without name", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", boardPublicId: "bd_1", colourCode: "#ff0000" })).rejects.toThrow("name");
  });

  it("create — throws without colourCode", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", boardPublicId: "bd_1", name: "Bug" })).rejects.toThrow("colourCode");
  });

  it("update — calls PUT /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "update", labelPublicId: "lbl_1", name: "Feature" });
    expect(client.put).toHaveBeenCalledWith("/labels/lbl_1", expect.objectContaining({ name: "Feature" }));
  });

  it("delete — calls DELETE /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "delete", labelPublicId: "lbl_1" });
    expect(client.delete).toHaveBeenCalledWith("/labels/lbl_1");
  });
});
```

**Step 2: Run to verify fail, then implement `src/tools/labels.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

type LabelsParams = {
  action: "get" | "create" | "update" | "delete";
  labelPublicId?: string;
  boardPublicId?: string;
  name?: string;
  colourCode?: string;
};

export async function labelsHandler(client: KanClient, params: LabelsParams): Promise<unknown> {
  switch (params.action) {
    case "get":
      if (!params.labelPublicId) throw new Error("labelPublicId required for get");
      return client.get(`/labels/${params.labelPublicId}`);
    case "create":
      if (!params.boardPublicId) throw new Error("boardPublicId required for create");
      if (!params.name) throw new Error("name required for create");
      if (!params.colourCode) throw new Error("colourCode required for create");
      return client.post("/labels", {
        name: params.name,
        boardPublicId: params.boardPublicId,
        colourCode: params.colourCode,
      });
    case "update":
      if (!params.labelPublicId) throw new Error("labelPublicId required for update");
      return client.put(`/labels/${params.labelPublicId}`, {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.colourCode !== undefined ? { colourCode: params.colourCode } : {}),
      });
    case "delete":
      if (!params.labelPublicId) throw new Error("labelPublicId required for delete");
      return client.delete(`/labels/${params.labelPublicId}`);
  }
}

export function registerLabelsTool(server: McpServer, client: KanClient): void {
  server.tool(
    "labels",
    "Manage Kan labels on a board: get, create (with hex colour), update, or delete.",
    {
      action: z.enum(["get", "create", "update", "delete"]).describe("Operation to perform"),
      labelPublicId: z.string().optional().describe("Label ID (required for get, update, delete)"),
      boardPublicId: z.string().optional().describe("Board ID (required for create)"),
      name: z.string().min(1).max(36).optional().describe("Label name (required for create, 1-36 chars)"),
      colourCode: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("7-char hex colour e.g. #ff0000 (required for create)"),
    },
    async (params) => {
      const result = await labelsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 3: Run test to verify pass, then commit**

Run: `npm test`

```bash
git add src/tools/labels.ts src/tools/labels.test.ts
git commit -m "feat: labels tool"
```

---

## Task 8: Card Actions Tools (Comments, Members, Labels)

**Files:**
- Create: `src/tools/card-actions.ts`
- Create: `src/tools/card-actions.test.ts`

**Step 1: Write failing test — `src/tools/card-actions.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { cardCommentsHandler, cardMembersHandler, cardLabelsHandler } from "./card-actions.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("cardCommentsHandler", () => {
  it("create — calls POST /cards/:id/comments", async () => {
    const client = makeClient();
    await cardCommentsHandler(client, { action: "create", cardPublicId: "card_1", comment: "Looks good" });
    expect(client.post).toHaveBeenCalledWith("/cards/card_1/comments", { comment: "Looks good" });
  });

  it("create — throws without comment", async () => {
    const client = makeClient();
    await expect(cardCommentsHandler(client, { action: "create", cardPublicId: "card_1" })).rejects.toThrow("comment");
  });

  it("update — calls PUT /cards/:id/comments/:commentId", async () => {
    const client = makeClient();
    await cardCommentsHandler(client, {
      action: "update",
      cardPublicId: "card_1",
      commentPublicId: "cmt_1",
      comment: "Updated text",
    });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1/comments/cmt_1", { comment: "Updated text" });
  });

  it("delete — calls DELETE /cards/:id/comments/:commentId", async () => {
    const client = makeClient();
    await cardCommentsHandler(client, { action: "delete", cardPublicId: "card_1", commentPublicId: "cmt_1" });
    expect(client.delete).toHaveBeenCalledWith("/cards/card_1/comments/cmt_1");
  });
});

describe("cardMembersHandler", () => {
  it("add — calls PUT /cards/:id/members/:memberId", async () => {
    const client = makeClient();
    await cardMembersHandler(client, { action: "add", cardPublicId: "card_1", workspaceMemberPublicId: "mem_1" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1/members/mem_1");
  });

  it("remove — calls same PUT endpoint (toggle)", async () => {
    const client = makeClient();
    await cardMembersHandler(client, { action: "remove", cardPublicId: "card_1", workspaceMemberPublicId: "mem_1" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1/members/mem_1");
  });
});

describe("cardLabelsHandler", () => {
  it("add — calls PUT /cards/:id/labels/:labelId", async () => {
    const client = makeClient();
    await cardLabelsHandler(client, { action: "add", cardPublicId: "card_1", labelPublicId: "lbl_1" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1/labels/lbl_1");
  });

  it("remove — calls same PUT endpoint (toggle)", async () => {
    const client = makeClient();
    await cardLabelsHandler(client, { action: "remove", cardPublicId: "card_1", labelPublicId: "lbl_1" });
    expect(client.put).toHaveBeenCalledWith("/cards/card_1/labels/lbl_1");
  });
});
```

**Step 2: Run to verify fail, then implement `src/tools/card-actions.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KanClient } from "../client.js";

// --- Comments ---

type CardCommentsParams = {
  action: "create" | "update" | "delete";
  cardPublicId?: string;
  commentPublicId?: string;
  comment?: string;
};

export async function cardCommentsHandler(client: KanClient, params: CardCommentsParams): Promise<unknown> {
  if (!params.cardPublicId) throw new Error("cardPublicId required");
  switch (params.action) {
    case "create":
      if (!params.comment) throw new Error("comment required for create");
      return client.post(`/cards/${params.cardPublicId}/comments`, { comment: params.comment });
    case "update":
      if (!params.commentPublicId) throw new Error("commentPublicId required for update");
      if (!params.comment) throw new Error("comment required for update");
      return client.put(`/cards/${params.cardPublicId}/comments/${params.commentPublicId}`, { comment: params.comment });
    case "delete":
      if (!params.commentPublicId) throw new Error("commentPublicId required for delete");
      return client.delete(`/cards/${params.cardPublicId}/comments/${params.commentPublicId}`);
  }
}

// --- Members ---

type CardMembersParams = {
  action: "add" | "remove";
  cardPublicId?: string;
  workspaceMemberPublicId?: string;
};

export async function cardMembersHandler(client: KanClient, params: CardMembersParams): Promise<unknown> {
  if (!params.cardPublicId) throw new Error("cardPublicId required");
  if (!params.workspaceMemberPublicId) throw new Error("workspaceMemberPublicId required");
  // The Kan API uses a toggle: PUT adds if absent, removes if present
  return client.put(`/cards/${params.cardPublicId}/members/${params.workspaceMemberPublicId}`);
}

// --- Labels on Cards ---

type CardLabelsParams = {
  action: "add" | "remove";
  cardPublicId?: string;
  labelPublicId?: string;
};

export async function cardLabelsHandler(client: KanClient, params: CardLabelsParams): Promise<unknown> {
  if (!params.cardPublicId) throw new Error("cardPublicId required");
  if (!params.labelPublicId) throw new Error("labelPublicId required");
  // The Kan API uses a toggle: PUT adds if absent, removes if present
  return client.put(`/cards/${params.cardPublicId}/labels/${params.labelPublicId}`);
}

// --- Registration ---

export function registerCardActionsTool(server: McpServer, client: KanClient): void {
  server.tool(
    "card_comments",
    "Add, edit, or delete comments on a Kan card.",
    {
      action: z.enum(["create", "update", "delete"]).describe("Operation to perform"),
      cardPublicId: z.string().describe("Card ID"),
      commentPublicId: z.string().optional().describe("Comment ID (required for update, delete)"),
      comment: z.string().min(1).optional().describe("Comment text (required for create, update)"),
    },
    async (params) => {
      const result = await cardCommentsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "card_members",
    "Add or remove a workspace member from a card. The Kan API is a toggle — the same endpoint adds if absent or removes if present.",
    {
      action: z.enum(["add", "remove"]).describe("Whether to add or remove the member"),
      cardPublicId: z.string().describe("Card ID"),
      workspaceMemberPublicId: z.string().describe("Workspace member ID to add or remove"),
    },
    async (params) => {
      const result = await cardMembersHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "card_labels",
    "Add or remove a label from a card. The Kan API is a toggle — the same endpoint adds if absent or removes if present.",
    {
      action: z.enum(["add", "remove"]).describe("Whether to add or remove the label"),
      cardPublicId: z.string().describe("Card ID"),
      labelPublicId: z.string().describe("Label ID to add or remove"),
    },
    async (params) => {
      const result = await cardLabelsHandler(client, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Step 3: Run test to verify pass, then commit**

Run: `npm test`
Expected: all tests PASS

```bash
git add src/tools/card-actions.ts src/tools/card-actions.test.ts
git commit -m "feat: card_comments, card_members, card_labels tools"
```

---

## Task 9: MCP Server Entry Point + README

**Files:**
- Create: `src/index.ts`
- Create: `README.md`

**Step 1: Create `src/index.ts`**

No unit test — this is pure wiring. Verified by building and running.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KanClient } from "./client.js";
import { registerWorkspacesTool } from "./tools/workspaces.js";
import { registerBoardsTool } from "./tools/boards.js";
import { registerListsTool } from "./tools/lists.js";
import { registerCardsTool } from "./tools/cards.js";
import { registerLabelsTool } from "./tools/labels.js";
import { registerCardActionsTool } from "./tools/card-actions.js";

const apiKey = process.env.KAN_API_KEY;
if (!apiKey) {
  console.error("Error: KAN_API_KEY environment variable is required.");
  console.error("Generate a key at https://kan.bn → Account Settings, then set KAN_API_KEY=kan_...");
  process.exit(1);
}

const client = new KanClient(apiKey);
const server = new McpServer({ name: "kan", version: "1.0.0" });

registerWorkspacesTool(server, client);
registerBoardsTool(server, client);
registerListsTool(server, client);
registerCardsTool(server, client);
registerLabelsTool(server, client);
registerCardActionsTool(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 2: Build and verify TypeScript**

Run: `npm run build`
Expected: `dist/` directory created, no errors

**Step 3: Smoke-test the server starts cleanly**

Run: `KAN_API_KEY=test node dist/index.js &`
Expected: process starts without printing an error (it will hang waiting for stdio input — kill it with `kill %1`)

**Step 4: Create `README.md`**

```markdown
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
        "KAN_API_KEY": "kan_your_key_here"
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
        "KAN_API_KEY": "kan_your_key_here"
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
```

**Step 5: Run all tests one final time**

Run: `npm test`
Expected: all tests PASS

**Step 6: Commit**

```bash
git add src/index.ts README.md
git commit -m "feat: MCP server entry point and README"
```
