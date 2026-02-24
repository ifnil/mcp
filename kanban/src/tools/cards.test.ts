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
