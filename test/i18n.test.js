import { test } from "node:test";
import assert from "node:assert/strict";
import { messages, t, getLang, setLang } from "../js/i18n.js";

test("zh and en define the same set of keys", () => {
  const zh = Object.keys(messages.zh).sort();
  const en = Object.keys(messages.en).sort();
  assert.deepEqual(en, zh);
  assert.ok(zh.length > 40, "dictionary should be comprehensive");
});

test("t returns the localized string for the current language", () => {
  setLang("zh");
  assert.equal(t("appTitle"), "音调与和弦侦测器");
  assert.equal(t("defaultMic"), "默认麦克风");

  setLang("en");
  assert.equal(t("appTitle"), "Tone & Chord Detector");
  assert.equal(t("statusIdle"), "Idle");
});

test("t substitutes {placeholder} parameters", () => {
  setLang("en");
  assert.equal(t("analyzing", { label: "Built-in Microphone" }), "Analyzing: Built-in Microphone");
  assert.equal(t("micNumber", { index: 3 }), "Mic 3");
  assert.equal(t("localFile", { name: "demo.wav" }), "Local file: demo.wav");
});

test("t falls back to the key itself when unknown", () => {
  assert.equal(t("this.key.does.not.exist"), "this.key.does.not.exist");
});

test("chord type names are localized per language", () => {
  setLang("zh");
  assert.equal(t("chordType.major"), "大三和弦");
  setLang("en");
  assert.equal(t("chordType.major"), "Major triad");
  assert.equal(t("chordType.dom7"), "Dominant seventh");
});

test("setLang validates and getLang returns a valid language in Node", () => {
  assert.equal(setLang("en"), "en");
  assert.equal(setLang("fr"), "zh");
  assert.ok(["zh", "en"].includes(getLang()));
});
