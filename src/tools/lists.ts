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
