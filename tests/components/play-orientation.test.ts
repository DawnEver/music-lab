import { beforeEach, describe, expect, it } from "vitest";
import {
  hydratePlay,
  instrument,
  orientation,
  setInstrument,
  setOrientation,
  settings
} from "../../src/features/play/stores/play.js";

/**
 * The direction a surface runs is a fact about that surface, not about the
 * app. One field cannot hold it: turning a guitar would turn the piano
 * with it, and a player who wants their neck down and their keyboard
 * across would have to choose.
 */
describe("orientation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    settings.orientations = {};
    settings.instrumentId = "piano";
  });

  it("gives a phone a neck with the frets down it", () => {
    hydratePlay(375);
    setInstrument("guitar");
    expect(orientation.value).toBe("vertical");
  });

  it("gives a phone a keyboard across it, not down it", () => {
    hydratePlay(375);
    setInstrument("piano");
    // The sixteeen-fret rule was never about a keyboard: nineteen keys of
    // 355x34px is not a rotated piano, it is a different instrument.
    expect(orientation.value).toBe("horizontal");
  });

  it("gives a phone's drum kit and wind chart the same answer", () => {
    hydratePlay(375);
    setInstrument("drums");
    expect(orientation.value).toBe("horizontal");
    setInstrument("dizi");
    expect(orientation.value).toBe("horizontal");
  });

  it("gives a laptop a neck across it", () => {
    hydratePlay(1280);
    setInstrument("guitar");
    expect(orientation.value).toBe("horizontal");
  });

  it("turns one surface without turning the others", () => {
    hydratePlay(1280);
    setInstrument("guitar");
    setOrientation("vertical");
    expect(orientation.value).toBe("vertical");

    setInstrument("piano");
    expect(orientation.value).toBe("horizontal");

    setInstrument("guitar");
    expect(orientation.value).toBe("vertical");
  });

  it("keeps the player's choice over the viewport's advice", () => {
    hydratePlay(375);
    setInstrument("guitar");
    setOrientation("horizontal");
    // A later visit on a narrow screen must not undo it.
    hydratePlay(375);
    expect(orientation.value).toBe("horizontal");
  });

  it("reads the single direction an older version stored as a neck", () => {
    window.localStorage.setItem(
      "ml.play",
      JSON.stringify({ instrumentId: "guitar", fretOrientation: "vertical" })
    );
    hydratePlay(1280);
    expect(orientation.value).toBe("vertical");
    // And it is a preference about necks only.
    expect(settings.orientations.keys).toBeUndefined();
    expect(instrument.value.id).toBe("guitar");
  });
});
