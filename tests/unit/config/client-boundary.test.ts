import { describe, expect, it } from "vitest";

describe("Client Component Secret Isolation Boundary [VO-016]", () => {
  it("enforces server-only boundary by throwing if server-only is loaded in a non-server environment", async () => {
    // In JSDOM / client simulation, loading unmocked 'server-only' must throw
    await expect(async () => {
      await import("server-only");
    }).rejects.toThrow(/This module cannot be imported from a Client Component module/);
  });
});
