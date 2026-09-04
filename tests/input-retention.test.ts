import { describe, expect, it, vi } from "vitest";
import { createInputRetention } from "../src/audio/retention.js";

describe("input retention", () => {
  it("stops the session when the last tool that needs input goes away", async () => {
    const stop = vi.fn();
    const retention = createInputRetention(stop);
    retention.retain();
    retention.release();
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("keeps it while another tool still needs it", async () => {
    const stop = vi.fn();
    const retention = createInputRetention(stop);
    retention.retain();
    retention.retain();
    retention.release();
    await Promise.resolve();
    expect(stop).not.toHaveBeenCalled();
  });

  it("survives a handover: the old view unmounts before the new one mounts", async () => {
    // Navigating from the tuner to the scope must not drop the microphone
    // the player already chose — the session belongs to the app.
    const stop = vi.fn();
    const retention = createInputRetention(stop);
    retention.retain();
    retention.release();
    retention.retain();
    await Promise.resolve();
    expect(stop).not.toHaveBeenCalled();
  });

  it("does not stop twice", async () => {
    const stop = vi.fn();
    const retention = createInputRetention(stop);
    retention.retain();
    retention.release();
    retention.release();
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("reports how many tools are holding it", () => {
    const retention = createInputRetention(() => undefined);
    retention.retain();
    retention.retain();
    expect(retention.holders()).toBe(2);
    retention.release();
    expect(retention.holders()).toBe(1);
  });
});
