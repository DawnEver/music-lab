import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * The engine's output chain, which nothing else can see.
 *
 * A voice is calibrated so that one note of it sits at a loudness, which
 * puts a single note near -8dBFS — and a player does not play one note.
 * Measured through this engine, ten notes at once ask for three decibels
 * more than exists, and a sound card answers that by flattening the peaks.
 * The limiter is what stands between the mix and that, and it is invisible
 * to every other test in the repo: the graph is only ever built inside a
 * real AudioContext, which is why it is built from a fake one here.
 */
interface FakeNode {
  kind: string;
  gain?: { value: number };
  threshold?: { value: number };
  ratio?: { value: number };
  knee?: { value: number };
  attack?: { value: number };
  release?: { value: number };
  outputs: FakeNode[];
  disconnected: boolean;
}

function fakeAudioContext() {
  const nodes: FakeNode[] = [];
  const make = (kind: string, extra: Partial<FakeNode> = {}): FakeNode => {
    const node: FakeNode = {
      kind,
      outputs: [],
      disconnected: false,
      connect(target: FakeNode) {
        node.outputs.push(target);
      },
      disconnect() {
        node.disconnected = true;
      },
      ...extra
    } as unknown as FakeNode;
    nodes.push(node);
    return node;
  };

  class FakeAudioContext {
    state = "running";
    destination = make("destination");
    createGain() {
      return make("gain", { gain: { value: 0 } });
    }
    createDynamicsCompressor() {
      return make("compressor", {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 }
      });
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    resume() {
      return Promise.resolve();
    }
  }

  return { nodes, FakeAudioContext };
}

async function freshEngine() {
  vi.resetModules();
  const fake = fakeAudioContext();
  vi.stubGlobal("window", { AudioContext: fake.FakeAudioContext });
  const context = await import("../src/audio/context.js");
  return { ...fake, context };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the output chain", () => {
  it("puts a limiter between the mix and the speakers", async () => {
    const { nodes, context } = await freshEngine();
    const handle = await context.acquireAudio();
    // The handle hands out real Web Audio types; the graph behind them is
    // the fake, and looking at it is the whole point of this test.
    const master = handle.master as unknown as FakeNode;
    const limiter = master.outputs.find((node) => node.kind === "compressor");
    expect(limiter, "nothing limits the mix").toBeDefined();
    expect(limiter!.outputs).toContain(nodes.find((node) => node.kind === "destination"));
  });

  it("leaves everything below the ceiling alone", async () => {
    const { context } = await freshEngine();
    const handle = await context.acquireAudio();
    const limiter = context.peekLimiter()!;
    // The point of a limiter rather than a smaller master gain: a single
    // note is nowhere near it, so nine notes in ten are untouched.
    expect(limiter.threshold.value).toBeLessThanOrEqual(-2);
    expect(limiter.ratio.value).toBeGreaterThanOrEqual(12);
    expect(limiter.knee.value).toBe(0);
    handle.release();
  });

  it("hands back the same limiter it is metering with", async () => {
    const { context } = await freshEngine();
    const handle = await context.acquireAudio();
    expect(context.peekLimiter()).toBe(context.peekLimiter());
    expect(context.peekLimiter()).not.toBeNull();
    handle.release();
    // The last lease closes the graph, and with it everything to look at.
    expect(context.peekLimiter()).toBeNull();
    expect(context.peekContext()).toBeNull();
  });
});
