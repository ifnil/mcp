import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { workspacesHandler } from "./workspaces.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("workspacesHandler", () => {
  it("list — calls GET /workspaces", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "list" });
    expect(client.get).toHaveBeenCalledWith("/workspaces");
  });

  it("get — calls GET /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "get", workspacePublicId: "ws_1" });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1");
  });

  it("get — throws without workspacePublicId", async () => {
    const client = makeClient();
    await expect(workspacesHandler(client, { action: "get" })).rejects.toThrow("workspacePublicId");
  });

  it("create — calls POST /workspaces with name", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "create", name: "Dev" });
    expect(client.post).toHaveBeenCalledWith("/workspaces", { name: "Dev" });
  });

  it("create — includes slug when provided", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "create", name: "Dev", slug: "dev" });
    expect(client.post).toHaveBeenCalledWith("/workspaces", { name: "Dev", slug: "dev" });
  });

  it("create — throws without name", async () => {
    const client = makeClient();
    await expect(workspacesHandler(client, { action: "create" })).rejects.toThrow("name");
  });

  it("update — calls PUT /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "update", workspacePublicId: "ws_1", name: "New" });
    expect(client.put).toHaveBeenCalledWith("/workspaces/ws_1", expect.objectContaining({ name: "New" }));
  });

  it("delete — calls DELETE /workspaces/:id", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "delete", workspacePublicId: "ws_1" });
    expect(client.delete).toHaveBeenCalledWith("/workspaces/ws_1");
  });

  it("search — calls GET with query param", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "search", workspacePublicId: "ws_1", query: "task" });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1/search?query=task");
  });

  it("search — includes limit when provided", async () => {
    const client = makeClient();
    await workspacesHandler(client, { action: "search", workspacePublicId: "ws_1", query: "bug", limit: 5 });
    expect(client.get).toHaveBeenCalledWith("/workspaces/ws_1/search?query=bug&limit=5");
  });
});
