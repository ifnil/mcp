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
