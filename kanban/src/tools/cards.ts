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
        description: params.description ?? "",
        position: params.position ?? "end",
        labelPublicIds: [],
        memberPublicIds: [],
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
