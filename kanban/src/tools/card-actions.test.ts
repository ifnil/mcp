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

// cardPublicId validation tests — added in code review fix

describe("cardCommentsHandler — cardPublicId validation", () => {
  it("create — throws without cardPublicId", async () => {
    const client = makeClient();
    await expect(cardCommentsHandler(client, { action: "create", comment: "hi" })).rejects.toThrow("cardPublicId");
  });
});

describe("cardMembersHandler — cardPublicId validation", () => {
  it("throws without cardPublicId", async () => {
    const client = makeClient();
    await expect(cardMembersHandler(client, { action: "add", workspaceMemberPublicId: "mem_1" })).rejects.toThrow("cardPublicId");
  });
});

describe("cardLabelsHandler — cardPublicId validation", () => {
  it("throws without cardPublicId", async () => {
    const client = makeClient();
    await expect(cardLabelsHandler(client, { action: "add", labelPublicId: "lbl_1" })).rejects.toThrow("cardPublicId");
  });
});
