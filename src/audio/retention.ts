/**
 * Who still needs the input.
 *
 * The session is application-level: a player chooses a microphone once and
 * moving between the tuner and the scope must not drop it. But a live
 * microphone in a tool that has no use for one is a privacy problem, so
 * the session stops when the last tool that needs it goes away.
 *
 * The check is deferred by a microtask because a route change unmounts the
 * old view before mounting the new one: without that, every navigation
 * would look like the last holder leaving.
 */

export interface InputRetention {
  retain(): void;
  release(): void;
  holders(): number;
}

export function createInputRetention(stop: () => void): InputRetention {
  let holders = 0;
  let checkQueued = false;

  return {
    retain() {
      holders += 1;
    },
    release() {
      holders = Math.max(0, holders - 1);
      if (holders > 0 || checkQueued) return;
      checkQueued = true;
      queueMicrotask(() => {
        checkQueued = false;
        if (holders === 0) stop();
      });
    },
    holders: () => holders
  };
}
