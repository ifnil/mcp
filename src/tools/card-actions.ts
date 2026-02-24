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
    "Add or remove a workspace member from a card. NOTE: The Kan API uses a single PUT toggle endpoint for both operations — 'action' is semantic only and both routes call the same endpoint. The API will add the member if they are not already assigned, or remove them if they are.",
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
    "Add or remove a label from a card. NOTE: The Kan API uses a single PUT toggle endpoint for both operations — 'action' is semantic only and both routes call the same endpoint. The API will add the label if not already applied, or remove it if it is.",
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
