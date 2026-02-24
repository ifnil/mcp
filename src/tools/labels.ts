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
