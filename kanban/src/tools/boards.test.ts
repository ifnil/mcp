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

  it("create — sends default lists and empty labels", async () => {
    const client = makeClient();
    await boardsHandler(client, { action: "create", workspacePublicId: "ws_1", name: "Backlog" });
    expect(client.post).toHaveBeenCalledWith("/workspaces/ws_1/boards", {
      name: "Backlog",
      lists: ["do", "doing", "done"],
      labels: [],
    });
  });

  it("create — forwards custom list names", async () => {
    const client = makeClient();
    await boardsHandler(client, {
      action: "create",
      workspacePublicId: "ws_1",
      name: "Life",
      lists: ["backlog", "do", "doing", "done"],
    });
    expect(client.post).toHaveBeenCalledWith("/workspaces/ws_1/boards", {
      name: "Life",
      lists: ["backlog", "do", "doing", "done"],
      labels: [],
    });
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
