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
