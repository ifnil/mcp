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
