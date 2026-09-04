/**
 * The shared input session, for the source bar and anything that needs to
 * know whether the app is listening.
 */

import {
  sourceStore,
  startMicrophone,
  startAudioFile,
  stop,
  populateDevices
} from "../audio/session.js";

export function useAudioSource() {
  return {
    sourceStore,
    startMic: startMicrophone,
    startFile: startAudioFile,
    stop,
    populateDevices
  };
}
