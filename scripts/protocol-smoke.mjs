import assert from "node:assert/strict";
import { buildPayload, defaultState } from "../src/protocol.js";

function lineValue(payload, key) {
  return payload
    .split("\n")
    .find((line) => line.startsWith(`${key},`))
    ?.split(",")[1];
}

for (const [activeColor, selector, activeField, inactiveField] of [
  ["white", "0", "waa", "raa"],
  ["red", "1", "raa", "waa"],
  ["green", "2", "gaa", "raa"],
  ["blue", "3", "baa", "raa"]
]) {
  const payload = buildPayload({ ...defaultState(), mode: "solid", activeColor, intensity: 70 });
  assert.equal(lineValue(payload, "rings"), "0", `${activeColor} should use solid ring mode`);
  assert.equal(lineValue(payload, "wrgbselect"), selector, `${activeColor} selector`);
  assert.equal(lineValue(payload, activeField), "70", `${activeColor} active channel`);
  assert.equal(lineValue(payload, inactiveField), "101", `${activeColor} inactive channel`);
}

assert.equal(buildPayload(defaultState(), "stop"), "doAllDemo,\nfileSendVal,\nstop,Stop\n");

const farDarkField = buildPayload({ ...defaultState(), mode: "darkfield", darkField: "far", intensity: 70 });
assert.equal(lineValue(farDarkField, "rings"), "2", "dark field ring mode");
assert.equal(lineValue(farDarkField, "dfselect"), "2", "far dark field selector");
for (const key of ["daa", "dab", "dac", "dad"]) {
  assert.equal(lineValue(farDarkField, key), "101", `${key} should be off for far dark field`);
}
for (const key of ["dea", "deb", "dec", "ded"]) {
  assert.equal(lineValue(farDarkField, key), "70", `${key} should be active for far dark field`);
}

const dome = buildPayload({ ...defaultState(), mode: "dome", dome: 55, activeColor: "red", intensity: 90, white: 80, red: 80, green: 80, blue: 80 });
assert.equal(lineValue(dome, "rings"), "4", "dome ring mode");
assert.equal(lineValue(dome, "ha"), "55", "dome intensity channel");
for (const key of ["waa", "wab", "wac", "wad", "raa", "rab", "rac", "rad", "gaa", "gab", "gac", "gad", "baa", "bab", "bac", "bad"]) {
  assert.equal(lineValue(dome, key), "101", `${key} should be off for dome`);
}
