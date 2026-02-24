import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanClient } from "./client.js";

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h: string) => (h === "content-type" ? contentType : null) },
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
  );
}

describe("KanClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.KAN_DEBUG;
  });

  it("sends x-api-key header on GET", async () => {
    mockFetch(200, { workspaces: [] });
    const client = new KanClient("test-key-123");
    await client.get("/workspaces");
    expect(fetch).toHaveBeenCalledWith(
      "https://board.local.gum.zone/api/v1/workspaces",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-api-key": "test-key-123" }),
      })
    );
  });

  it("sends JSON body and Content-Type on POST", async () => {
    mockFetch(200, { publicId: "board_123" });
    const client = new KanClient("key");
    await client.post("/boards", { name: "My Board" });
    expect(fetch).toHaveBeenCalledWith(
      "https://board.local.gum.zone/api/v1/boards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My Board" }),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("throws on 4xx with status in message", async () => {
    mockFetch(404, { message: "Not found" });
    const client = new KanClient("key");
    await expect(client.get("/boards/bad")).rejects.toThrow("Kan API 404");
  });

  it("throws on 5xx with status in message", async () => {
    mockFetch(500, { message: "Internal error" });
    const client = new KanClient("key");
    await expect(client.get("/workspaces")).rejects.toThrow("Kan API 500");
  });

  it("returns parsed JSON body on success", async () => {
    mockFetch(200, [{ publicId: "ws_1", name: "My Workspace" }]);
    const client = new KanClient("key");
    const result = await client.get<{ publicId: string; name: string }[]>("/workspaces");
    expect(result).toEqual([{ publicId: "ws_1", name: "My Workspace" }]);
  });

  it("emits debug logs when KAN_DEBUG is enabled", async () => {
    process.env.KAN_DEBUG = "1";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    mockFetch(200, { workspaces: [] });

    const client = new KanClient("key");
    await client.get("/workspaces");

    const logs = errorSpy.mock.calls.map(([line]) => String(line));
    expect(logs.some((line) => line.includes("[kan-debug]"))).toBe(true);
    expect(logs.some((line) => line.includes("GET https://board.local.gum.zone/api/v1/workspaces"))).toBe(true);
    expect(logs.some((line) => line.includes("status=200"))).toBe(true);
  });

  it("does not emit debug logs when KAN_DEBUG is disabled", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    mockFetch(200, { workspaces: [] });

    const client = new KanClient("key");
    await client.get("/workspaces");

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
