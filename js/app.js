/**
 * Tone Chord Lab — application controller.
 *
 * Wires the analysis modules to the DOM: owns element references, app state,
 * the Web Audio graph, the render loop, and all UI event handling.
 */

import { NOTE_NAMES, frequencyToNote } from "./music-theory.js";
import { clamp, detectPitchYin, analyzeSpectrum } from "./dsp.js";
import { detectChord, hasPolyphonicEvidence } from "./chord.js";
import { drawSpectrum, clearSpectrumCanvas, resizeCanvas } from "./draw.js";
import { t, setLang, applyStaticI18n } from "./i18n.js";

const FFT_SIZE = 16384;

const els = {
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  secureNotice: document.getElementById("secureNotice"),
  noteName: document.getElementById("noteName"),
  noteOctave: document.getElementById("noteOctave"),
  frequencyValue: document.getElementById("frequencyValue"),
  pitchHint: document.getElementById("pitchHint"),
  pitchMethod: document.getElementById("pitchMethod"),
  pitchConfidenceText: document.getElementById("pitchConfidenceText"),
  pitchConfidenceBar: document.getElementById("pitchConfidenceBar"),
  centsValue: document.getElementById("centsValue"),
  tunerNeedle: document.getElementById("tunerNeedle"),
  chordName: document.getElementById("chordName"),
  chordDescription: document.getElementById("chordDescription"),
  chordConfidence: document.getElementById("chordConfidence"),
  chroma: document.getElementById("chroma"),
  spectrumCanvas: document.getElementById("spectrumCanvas"),
  spectrumWrap: document.getElementById("spectrumWrap"),
  spectrumEmpty: document.getElementById("spectrumEmpty"),
  sampleRateMeta: document.getElementById("sampleRateMeta"),
  levelBar: document.getElementById("levelBar"),
  levelDb: document.getElementById("levelDb"),
  micButton: document.getElementById("micButton"),
  fileInput: document.getElementById("fileInput"),
  stopButton: document.getElementById("stopButton"),
  sourceInfo: document.getElementById("sourceInfo"),
  deviceSelect: document.getElementById("deviceSelect"),
  audioHost: document.getElementById("audioHost"),
  tuningRange: document.getElementById("tuningRange"),
  tuningOutput: document.getElementById("tuningOutput"),
  gateRange: document.getElementById("gateRange"),
  gateOutput: document.getElementById("gateOutput"),
  stabilityRange: document.getElementById("stabilityRange"),
  stabilityOutput: document.getElementById("stabilityOutput"),
  toast: document.getElementById("toast")
};

const state = {
  mode: "idle",
  audioContext: null,
  analyser: null,
  sourceNode: null,
  outputGain: null,
  stream: null,
  audioElement: null,
  objectUrl: null,
  animationId: 0,
  frequencyData: null,
  timeData: null,
  chromaSmooth: new Float32Array(12),
  latestChroma: new Float32Array(12),
  latestPitch: null,
  latestSpectralPitch: null,
  latestSpectralPitchAt: 0,
  pitchHistory: [],
  lastPitchAt: 0,
  lastSpectrumAt: 0,
  lastSignalAt: 0,
  lastChordCandidate: "",
  chordCandidateCount: 0,
  displayedChord: null,
  tuning: Number(els.tuningRange.value),
  gateDb: Number(els.gateRange.value),
  stability: Number(els.stabilityRange.value) / 100,
  toastTimer: 0,
  isStarting: false,
  statusKey: "statusIdle",
  statusMode: "idle",
  sourceInfoKey: "sourceInfoDefault",
  sourceInfoParams: {},
  sourceInfoOverride: ""
};

const chromaColumns = [];

function createChromaBars() {
  const fragment = document.createDocumentFragment();
  NOTE_NAMES.forEach((name, index) => {
    const col = document.createElement("div");
    col.className = "chroma-col";

    const rail = document.createElement("div");
    rail.className = "chroma-rail";

    const bar = document.createElement("div");
    bar.className = "chroma-bar";
    bar.style.height = "5%";
    rail.appendChild(bar);

    const label = document.createElement("div");
    label.className = "chroma-label";
    label.textContent = name;

    col.append(rail, label);
    fragment.appendChild(col);
    chromaColumns.push({ col, bar, label, index });
  });
  els.chroma.appendChild(fragment);
}

function setStatus(key, mode = "idle") {
  state.statusKey = key;
  state.statusMode = mode;
  els.statusText.textContent = t(key);
  els.statusPill.dataset.state = mode;
}

function setSourceInfo(key, params = {}) {
  state.sourceInfoKey = key;
  state.sourceInfoParams = params;
  state.sourceInfoOverride = "";
  renderSourceInfo();
}

function setSourceInfoRaw(text) {
  state.sourceInfoOverride = text;
  renderSourceInfo();
}

function renderSourceInfo() {
  els.sourceInfo.textContent = state.sourceInfoOverride || t(state.sourceInfoKey, state.sourceInfoParams);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 4200);
}

function resetReadouts(keepSpectrum = false) {
  state.latestPitch = null;
  state.latestSpectralPitch = null;
  state.latestSpectralPitchAt = 0;
  state.pitchHistory = [];
  state.lastChordCandidate = "";
  state.chordCandidateCount = 0;
  state.displayedChord = null;
  state.chromaSmooth.fill(0);
  state.latestChroma.fill(0);

  els.noteName.textContent = "…";
  els.noteOctave.textContent = "";
  els.frequencyValue.textContent = "— Hz";
  els.pitchHint.textContent = state.mode === "idle" ? t("pitchHintIdle") : t("pitchHintAwait");
  els.pitchMethod.textContent = t("pitchMethodWaiting");
  els.pitchConfidenceText.textContent = "0%";
  els.pitchConfidenceBar.style.width = "0%";
  els.centsValue.textContent = "0 cent";
  els.tunerNeedle.style.left = "50%";

  els.chordName.textContent = "…";
  els.chordDescription.textContent = t("chordDescriptionWaiting");
  els.chordConfidence.textContent = t("chordConfidence0");
  updateChromaDisplay(new Float32Array(12), null);

  els.levelBar.style.width = "0%";
  els.levelDb.textContent = "−∞ dB";

  if (!keepSpectrum) {
    els.spectrumEmpty.classList.remove("hidden");
    clearSpectrumCanvas(els.spectrumCanvas, els.spectrumWrap);
  }
}

function updateControls() {
  const active = state.mode !== "idle";
  els.stopButton.disabled = !active && !state.isStarting;
  els.micButton.disabled = state.isStarting || state.mode === "mic";
  els.micButton.querySelector("span:last-child").textContent =
    state.mode === "file" ? t("switchMic") : state.mode === "mic" ? t("micRunning") : t("micButton");
}

function updateLevel(rmsDb) {
  const normalized = clamp((rmsDb + 72) / 72, 0, 1);
  els.levelBar.style.width = `${(normalized * 100).toFixed(1)}%`;
  els.levelDb.textContent = formatDb(rmsDb);
}

function formatDb(value) {
  if (!Number.isFinite(value) || value < -100) return "−∞ dB";
  return `${Math.round(value).toString().replace("-", "−")} dB`;
}

function smoothPitchCandidate(pitch, now) {
  if (!pitch) return null;

  const history = state.pitchHistory.filter((item) => now - item.time < 360);
  state.pitchHistory = history;

  let frequency = pitch.frequency;
  if (history.length >= 2) {
    const centsValues = history
      .map((item) => 1200 * Math.log2(item.frequency))
      .sort((a, b) => a - b);
    const medianCents = centsValues[Math.floor(centsValues.length / 2)];
    const currentCents = 1200 * Math.log2(frequency);
    const delta = currentCents - medianCents;

    if (Math.abs(Math.abs(delta) - 1200) < 75) {
      frequency *= delta > 0 ? 0.5 : 2;
    }
  }

  state.pitchHistory.push({
    frequency,
    confidence: pitch.confidence,
    time: now
  });

  if (state.pitchHistory.length > 7) {
    state.pitchHistory.shift();
  }

  let weightedLog = 0;
  let weightSum = 0;
  for (const item of state.pitchHistory) {
    const weight = Math.max(0.08, item.confidence);
    weightedLog += Math.log2(item.frequency) * weight;
    weightSum += weight;
  }

  return {
    frequency: Math.pow(2, weightedLog / Math.max(weightSum, 1e-9)),
    confidence: pitch.confidence,
    method: pitch.method
  };
}

function choosePitch(yinPitch, spectralPitch, polyphonic = false) {
  if (polyphonic && spectralPitch && spectralPitch.confidence >= 0.28) {
    return spectralPitch;
  }

  if (yinPitch && spectralPitch) {
    const distance = Math.abs(1200 * Math.log2(yinPitch.frequency / spectralPitch.frequency));
    const octaveResidual = Math.abs(distance - Math.round(distance / 1200) * 1200);

    if (octaveResidual < 45) {
      if (yinPitch.confidence >= 0.55) return yinPitch;
      return spectralPitch;
    }
  }

  if (yinPitch && yinPitch.confidence >= 0.62) return yinPitch;
  if (spectralPitch && spectralPitch.confidence >= 0.34) return spectralPitch;
  return yinPitch || spectralPitch || null;
}

function stabilizeChord(candidate) {
  const key = candidate ? `${candidate.root}:${candidate.type.suffix}` : "";

  if (!candidate) {
    state.chordCandidateCount = Math.max(0, state.chordCandidateCount - 1);
    if (state.chordCandidateCount === 0) {
      state.lastChordCandidate = "";
      state.displayedChord = null;
    }
    return state.displayedChord;
  }

  if (key === state.lastChordCandidate) {
    state.chordCandidateCount += 1;
  } else {
    state.lastChordCandidate = key;
    state.chordCandidateCount = 1;
  }

  const requiredFrames = candidate.confidence > 0.72 ? 2 : 3;
  if (state.chordCandidateCount >= requiredFrames) {
    state.displayedChord = candidate;
  }

  return state.displayedChord;
}

function updatePitchDisplay(pitch) {
  if (!pitch) {
    els.noteName.textContent = "…";
    els.noteOctave.textContent = "";
    els.frequencyValue.textContent = "— Hz";
    els.pitchMethod.textContent = t("pitchMethodWaiting");
    els.pitchConfidenceText.textContent = "0%";
    els.pitchConfidenceBar.style.width = "0%";
    els.centsValue.textContent = "0 cent";
    els.tunerNeedle.style.left = "50%";
    return;
  }

  const note = frequencyToNote(pitch.frequency, state.tuning);
  const confidencePercent = Math.round(clamp(pitch.confidence, 0, 1) * 100);
  const cents = clamp(note.cents, -50, 50);
  const centsRounded = Math.round(note.cents);
  const centsPrefix = centsRounded > 0 ? "+" : centsRounded < 0 ? "−" : "";

  els.noteName.textContent = note.name;
  els.noteOctave.textContent = String(note.octave);
  els.frequencyValue.textContent = `${pitch.frequency.toFixed(pitch.frequency < 100 ? 2 : 1)} Hz`;
  els.pitchHint.textContent = Math.abs(note.cents) <= 5 ? t("pitchHintStable") : note.cents < 0 ? t("pitchHintFlat") : t("pitchHintSharp");
  els.pitchMethod.textContent = t(`method.${pitch.method}`);
  els.pitchConfidenceText.textContent = `${confidencePercent}%`;
  els.pitchConfidenceBar.style.width = `${confidencePercent}%`;
  els.centsValue.textContent = `${centsPrefix}${Math.abs(centsRounded)} cent`;
  els.tunerNeedle.style.left = `${50 + cents}%`;
}

function updateChordDisplay(chord) {
  if (!chord) {
    els.chordName.textContent = "…";
    els.chordDescription.textContent = t("chordDescriptionWaiting");
    els.chordConfidence.textContent = t("chordConfidence0");
    updateChromaDisplay(state.latestChroma, null);
    return;
  }

  const noteList = chord.tones.map((pc) => NOTE_NAMES[pc]).join(" · ");
  const confidencePercent = Math.round(chord.confidence * 100);

  els.chordName.textContent = chord.symbol;
  els.chordDescription.textContent = `${t(`chordType.${chord.descriptionKey}`)} · ${noteList}`;
  els.chordConfidence.textContent = `${confidencePercent}% ${t("match")}`;
  updateChromaDisplay(state.latestChroma, chord);
}

function updateChromaDisplay(chroma, chord) {
  const maxValue = Math.max(0.001, ...chroma);
  const toneSet = new Set(chord ? chord.tones : []);

  chromaColumns.forEach(({ col, bar, index }) => {
    const height = 5 + 95 * clamp(chroma[index] / maxValue, 0, 1);
    bar.style.height = `${height.toFixed(1)}%`;
    col.classList.toggle("is-tone", toneSet.has(index));
    col.classList.toggle("is-root", Boolean(chord && chord.root === index));
  });
}

function clearAfterSilence(now) {
  if (now - state.lastSignalAt < 420) return;

  state.latestPitch = null;
  state.latestSpectralPitch = null;
  state.latestSpectralPitchAt = 0;
  state.pitchHistory = [];
  state.displayedChord = null;
  state.lastChordCandidate = "";
  state.chordCandidateCount = 0;

  updatePitchDisplay(null);
  updateChordDisplay(null);

  for (let i = 0; i < 12; i += 1) {
    state.chromaSmooth[i] *= 0.78;
    state.latestChroma[i] = state.chromaSmooth[i];
  }
  updateChromaDisplay(state.latestChroma, null);
}

function renderLoop(now) {
  if (!state.analyser || !state.audioContext) return;

  state.analyser.getFloatFrequencyData(state.frequencyData);
  drawSpectrum(state.frequencyData, {
    canvas: els.spectrumCanvas,
    wrap: els.spectrumWrap,
    sampleRate: state.audioContext.sampleRate,
    latestPitch: state.latestPitch,
    fftSize: state.analyser.fftSize,
    tuning: state.tuning
  });
  els.spectrumEmpty.classList.add("hidden");

  let yinResult = null;
  if (now - state.lastPitchAt >= 88) {
    state.lastPitchAt = now;
    state.analyser.getFloatTimeDomainData(state.timeData);
    yinResult = detectPitchYin(state.timeData, state.audioContext.sampleRate, state.gateDb);
    updateLevel(yinResult.rmsDb);

    if (yinResult.rmsDb >= state.gateDb) {
      state.lastSignalAt = now;
    }
  }

  let spectralResult = null;
  if (now - state.lastSpectrumAt >= 105) {
    state.lastSpectrumAt = now;
    spectralResult = analyzeSpectrum(
      state.frequencyData,
      state.audioContext.sampleRate,
      state.analyser.fftSize,
      { tuning: state.tuning, gateDb: state.gateDb }
    );
    state.latestSpectralPitch = spectralResult.dominantPitch;
    state.latestSpectralPitchAt = now;

    const chromaAlpha = clamp(state.stability, 0.2, 0.92);
    for (let i = 0; i < 12; i += 1) {
      state.chromaSmooth[i] =
        state.chromaSmooth[i] * chromaAlpha +
        spectralResult.chroma[i] * (1 - chromaAlpha);
      state.latestChroma[i] = state.chromaSmooth[i];
    }

    const chordCandidate = detectChord(state.latestChroma);
    const stableChord = stabilizeChord(chordCandidate);
    updateChordDisplay(stableChord);
  }

  if (yinResult || spectralResult) {
    const recentSpectralPitch = spectralResult
      ? spectralResult.dominantPitch
      : now - state.latestSpectralPitchAt < 280
        ? state.latestSpectralPitch
        : null;
    const polyphonic = Boolean(state.displayedChord) || hasPolyphonicEvidence(state.latestChroma);
    const selectedPitch = choosePitch(
      yinResult ? yinResult.pitch : null,
      recentSpectralPitch,
      polyphonic
    );

    if (selectedPitch) {
      state.lastSignalAt = now;
      state.latestPitch = smoothPitchCandidate(selectedPitch, now);
      updatePitchDisplay(state.latestPitch);
    } else {
      clearAfterSilence(now);
    }
  } else {
    clearAfterSilence(now);
  }

  state.animationId = requestAnimationFrame(renderLoop);
}

function beginAnalysis() {
  cancelAnimationFrame(state.animationId);
  state.lastPitchAt = 0;
  state.lastSpectrumAt = 0;
  state.lastSignalAt = performance.now();
  state.pitchHistory = [];
  state.chromaSmooth.fill(0);
  state.latestChroma.fill(0);
  state.latestPitch = null;
  state.latestSpectralPitch = null;
  state.latestSpectralPitchAt = 0;
  state.displayedChord = null;
  els.spectrumEmpty.classList.add("hidden");
  state.animationId = requestAnimationFrame(renderLoop);
}

async function createAudioGraph(mode) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error(t("errWebAudio"));
  }

  state.audioContext = new AudioContextClass({ latencyHint: "interactive" });
  await state.audioContext.resume();

  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = FFT_SIZE;
  state.analyser.minDecibels = -100;
  state.analyser.maxDecibels = -10;
  state.analyser.smoothingTimeConstant = clamp(state.stability, 0.2, 0.92);

  state.outputGain = state.audioContext.createGain();
  state.outputGain.gain.value = mode === "mic" ? 0 : 0.92;
  state.analyser.connect(state.outputGain);
  state.outputGain.connect(state.audioContext.destination);

  state.frequencyData = new Float32Array(state.analyser.frequencyBinCount);
  state.timeData = new Float32Array(state.analyser.fftSize);
  els.sampleRateMeta.textContent = `${(state.audioContext.sampleRate / 1000).toFixed(1)} kHz`;
}

async function populateDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    const previousValue = els.deviceSelect.value;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter((device) => device.kind === "audioinput");

    els.deviceSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = t("defaultMic");
    els.deviceSelect.appendChild(defaultOption);

    microphones.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || t("micNumber", { index: index + 1 });
      els.deviceSelect.appendChild(option);
    });

    els.deviceSelect.disabled = microphones.length === 0;
    if (previousValue && microphones.some((device) => device.deviceId === previousValue)) {
      els.deviceSelect.value = previousValue;
    }
  } catch (error) {
    console.warn(t("cannotEnumerate"), error);
  }
}

async function stopAudio(resetUi = true) {
  cancelAnimationFrame(state.animationId);
  state.animationId = 0;

  if (state.audioElement) {
    state.audioElement.pause();
    state.audioElement.removeAttribute("src");
    state.audioElement.load();
    state.audioElement = null;
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  for (const node of [state.sourceNode, state.analyser, state.outputGain]) {
    try {
      if (node) node.disconnect();
    } catch (_) {
      // Node may already be disconnected.
    }
  }

  state.sourceNode = null;
  state.analyser = null;
  state.outputGain = null;

  if (state.audioContext && state.audioContext.state !== "closed") {
    try {
      await state.audioContext.close();
    } catch (_) {
      // Ignore race errors when closing.
    }
  }
  state.audioContext = null;

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  els.audioHost.replaceChildren();
  state.mode = "idle";

  if (resetUi) {
    setStatus("statusIdle", "idle");
    setSourceInfo("sourceInfoDefault");
    resetReadouts();
  }

  updateControls();
}

async function startMicrophone() {
  if (state.isStarting) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    els.secureNotice.classList.add("show");
    setStatus("statusMicUnavailable", "error");
    showToast(t("toastMicSecure"));
    return;
  }

  state.isStarting = true;
  updateControls();
  setStatus("statusRequesting", "idle");

  try {
    await stopAudio(false);
    state.isStarting = true;
    updateControls();

    const selectedDeviceId = els.deviceSelect.value;
    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    };

    if (selectedDeviceId) {
      audioConstraints.deviceId = { exact: selectedDeviceId };
    }

    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false
    });

    await createAudioGraph("mic");
    state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);
    state.sourceNode.connect(state.analyser);
    state.mode = "mic";
    els.secureNotice.classList.remove("show");

    const activeTrack = state.stream.getAudioTracks()[0];
    const label = activeTrack && activeTrack.label ? activeTrack.label : t("defaultMic");
    setSourceInfo("analyzing", { label });
    setStatus("statusMicLive", "live");
    resetReadouts(true);
    beginAnalysis();
    await populateDevices();
  } catch (error) {
    console.error(error);
    await stopAudio(false);
    state.mode = "idle";
    setStatus("statusStartFailed", "error");

    const unknown = t("unknownError");
    const message = error && error.name === "NotAllowedError"
      ? t("toastMicDenied")
      : error && error.name === "NotFoundError"
        ? t("toastNoMic")
        : t("toastMicStartFailed", { message: error && error.message ? error.message : unknown });

    showToast(message);
    setSourceInfoRaw(message);
    resetReadouts();
  } finally {
    state.isStarting = false;
    updateControls();
  }
}

async function startAudioFile(file) {
  if (!file) return;
  if (state.isStarting) return;

  state.isStarting = true;
  updateControls();
  setStatus("statusLoadingFile", "idle");

  try {
    await stopAudio(false);
    state.isStarting = true;
    updateControls();

    await createAudioGraph("file");
    state.objectUrl = URL.createObjectURL(file);
    state.audioElement = document.createElement("audio");
    state.audioElement.controls = true;
    state.audioElement.preload = "metadata";
    state.audioElement.src = state.objectUrl;
    state.audioElement.setAttribute("aria-label", t("localAudioAria", { name: file.name }));
    els.audioHost.replaceChildren(state.audioElement);

    state.sourceNode = state.audioContext.createMediaElementSource(state.audioElement);
    state.sourceNode.connect(state.analyser);
    state.mode = "file";

    state.audioElement.addEventListener("play", async () => {
      if (state.audioContext && state.audioContext.state === "suspended") {
        await state.audioContext.resume();
      }
      setStatus("statusFilePlaying", "live");
    });

    state.audioElement.addEventListener("pause", () => {
      if (state.mode === "file") setStatus("statusFilePaused", "idle");
    });

    state.audioElement.addEventListener("ended", () => {
      if (state.mode === "file") setStatus("statusFileEnded", "idle");
    });

    state.audioElement.addEventListener("error", () => {
      showToast(t("toastDecodeFailed"));
    });

    setSourceInfo("localFile", { name: file.name });
    resetReadouts(true);
    beginAnalysis();

    try {
      await state.audioElement.play();
    } catch (_) {
      setStatus("statusAwaitPlay", "idle");
      showToast(t("toastFileLoaded"));
    }
  } catch (error) {
    console.error(error);
    await stopAudio(false);
    state.mode = "idle";
    setStatus("statusLoadFailed", "error");
    const message = t("toastFileFailed", { message: error && error.message ? error.message : t("unknownError") });
    setSourceInfoRaw(message);
    showToast(message);
    resetReadouts();
  } finally {
    state.isStarting = false;
    updateControls();
    els.fileInput.value = "";
  }
}

function handleSettingsChange() {
  state.tuning = Number(els.tuningRange.value);
  state.gateDb = Number(els.gateRange.value);
  state.stability = Number(els.stabilityRange.value) / 100;

  els.tuningOutput.textContent = `${state.tuning} Hz`;
  els.gateOutput.textContent = `${String(state.gateDb).replace("-", "−")} dB`;
  els.stabilityOutput.textContent = `${Math.round(state.stability * 100)}%`;

  if (state.analyser) {
    state.analyser.smoothingTimeConstant = clamp(state.stability, 0.2, 0.92);
  }
}

/** Re-render strings that are driven by app state (after a language switch). */
function renderDynamicTexts() {
  setStatus(state.statusKey, state.statusMode);
  renderSourceInfo();
  updatePitchDisplay(state.latestPitch);
  updateChordDisplay(state.displayedChord);
  updateControls();
}

function initialize() {
  createChromaBars();
  applyStaticI18n();
  handleSettingsChange();
  resizeCanvas(els.spectrumCanvas, els.spectrumWrap);
  clearSpectrumCanvas(els.spectrumCanvas, els.spectrumWrap);
  updateControls();

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    els.secureNotice.classList.add("show");
  }

  els.micButton.addEventListener("click", startMicrophone);
  els.stopButton.addEventListener("click", () => stopAudio(true));
  els.fileInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    startAudioFile(file);
  });

  els.deviceSelect.addEventListener("change", () => {
    if (state.mode === "mic") startMicrophone();
  });

  document.querySelectorAll(".lang-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      setLang(button.dataset.lang);
      applyStaticI18n();
      renderDynamicTexts();
    });
  });

  [els.tuningRange, els.gateRange, els.stabilityRange].forEach((input) => {
    input.addEventListener("input", handleSettingsChange);
  });

  document.querySelector('label[for="fileInput"]').addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.fileInput.click();
    }
  });

  window.addEventListener("resize", () => resizeCanvas(els.spectrumCanvas, els.spectrumWrap));
  window.addEventListener("beforeunload", () => {
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", populateDevices);
  }
}

initialize();

window.ToneChordLab = Object.freeze({
  detectPitchYin,
  analyzeSpectrum,
  detectChord,
  frequencyToNote
});
