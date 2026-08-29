/**
 * Audio session actions, exposed as a composable for the source controls.
 */

import {
  audioStore,
  startMicrophone,
  startAudioFile,
  stop,
  populateDevices
} from "../features/tuning/stores/audio.js";

export function useAudio() {
  return {
    audioStore,
    startMic: startMicrophone,
    startFile: startAudioFile,
    stop,
    populateDevices
  };
}
