import { describe, it, expect, vi } from "vitest";
import type { KanClient } from "../client.js";
import { labelsHandler } from "./labels.js";

function makeClient(): KanClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue({}),
  } as unknown as KanClient;
}

describe("labelsHandler", () => {
  it("get — calls GET /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "get", labelPublicId: "lbl_1" });
    expect(client.get).toHaveBeenCalledWith("/labels/lbl_1");
  });

  it("create — calls POST /labels", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "create", boardPublicId: "bd_1", name: "Bug", colourCode: "#ff0000" });
    expect(client.post).toHaveBeenCalledWith("/labels", {
      name: "Bug",
      boardPublicId: "bd_1",
      colourCode: "#ff0000",
    });
  });

  it("create — throws without boardPublicId", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", name: "Bug", colourCode: "#ff0000" })).rejects.toThrow("boardPublicId");
  });

  it("create — throws without name", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", boardPublicId: "bd_1", colourCode: "#ff0000" })).rejects.toThrow("name");
  });

  it("create — throws without colourCode", async () => {
    const client = makeClient();
    await expect(labelsHandler(client, { action: "create", boardPublicId: "bd_1", name: "Bug" })).rejects.toThrow("colourCode");
  });

  it("update — calls PUT /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "update", labelPublicId: "lbl_1", name: "Feature" });
    expect(client.put).toHaveBeenCalledWith("/labels/lbl_1", expect.objectContaining({ name: "Feature" }));
  });

  it("delete — calls DELETE /labels/:id", async () => {
    const client = makeClient();
    await labelsHandler(client, { action: "delete", labelPublicId: "lbl_1" });
    expect(client.delete).toHaveBeenCalledWith("/labels/lbl_1");
  });
});
