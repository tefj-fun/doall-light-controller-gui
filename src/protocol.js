export const FIELD_NAMES = [
  "waa",
  "wab",
  "wac",
  "wad",
  "raa",
  "rab",
  "rac",
  "rad",
  "gaa",
  "gab",
  "gac",
  "gad",
  "baa",
  "bab",
  "bac",
  "bad",
  "daa",
  "dab",
  "dac",
  "dad",
  "dea",
  "deb",
  "dec",
  "ded",
  "iaa",
  "iab",
  "iac",
  "iad",
  "ha",
  "ja",
  "ka",
  "la",
  "ma",
  "jb",
  "kb",
  "na",
  "oa",
  "pa",
  "qa"
];

export const QUADRANTS = ["A", "B", "C", "D"];

const COLOR_FIELDS = {
  white: ["waa", "wab", "wac", "wad"],
  red: ["raa", "rab", "rac", "rad"],
  green: ["gaa", "gab", "gac", "gad"],
  blue: ["baa", "bab", "bac", "bad"]
};

const COLOR_SELECT = {
  white: 0,
  red: 1,
  green: 2,
  blue: 3
};

const DARK_FIELD_SELECT = {
  both: 0,
  near: 1,
  far: 2
};

export const MODES = [
  { id: "solid", label: "Solid Color Quadrants", ring: 0, icon: "white.png" },
  { id: "mixed", label: "Color Mixed Ring", ring: 1, icon: "colorMixed.png" },
  { id: "darkfield", label: "Dark Field Ring", ring: 2, icon: "darkField.png" },
  { id: "ir", label: "IR", ring: 3, icon: "IR.png" },
  { id: "dome", label: "Dome Light", ring: 4, icon: "dome.png" },
  { id: "aux", label: "DoAll Aux Out", ring: 5, icon: "link_icon.png" },
  { id: "digital", label: "DLM Digital Out", ring: 6, icon: "reload_icon.png" }
];

export function defaultState() {
  return {
    mode: "solid",
    activeColor: "white",
    quadrants: [true, true, true, true],
    darkField: "both",
    intensity: 70,
    white: 70,
    red: 0,
    green: 0,
    blue: 0,
    dome: 85,
    ir: 65,
    aux1: 0,
    aux2: 0,
    digital: [false, false, false, false],
    strobeCount: 5,
    strobeMs: 180
  };
}

function clampValue(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function buildPayload(state, command = "run") {
  if (command === "stop") return "doAllDemo,\nfileSendVal,\nstop,Stop\n";

  const mode = MODES.find((item) => item.id === state.mode) || MODES[0];
  const values = Object.fromEntries(FIELD_NAMES.map((name) => [name, 101]));
  const scaled = (value) => clampValue(value);
  const wrgbSelect = state.mode === "solid" ? COLOR_SELECT[state.activeColor] ?? COLOR_SELECT.white : 0;
  const dfSelect = state.mode === "darkfield" ? DARK_FIELD_SELECT[state.darkField] ?? DARK_FIELD_SELECT.both : 0;

  if (state.mode === "solid") {
    const colorFields = COLOR_FIELDS[state.activeColor] || COLOR_FIELDS.white;
    colorFields.forEach((name, index) => {
      values[name] = state.quadrants[index] ? scaled(state.intensity) : 101;
    });
  }

  if (state.mode === "mixed") {
    ["waa", "wab", "wac", "wad"].forEach((name) => (values[name] = scaled(state.white)));
    ["raa", "rab", "rac", "rad"].forEach((name) => (values[name] = scaled(state.red)));
    ["gaa", "gab", "gac", "gad"].forEach((name) => (values[name] = scaled(state.green)));
    ["baa", "bab", "bac", "bad"].forEach((name) => (values[name] = scaled(state.blue)));
  }

  if (state.mode === "darkfield") {
    const near = state.darkField === "both" || state.darkField === "near";
    const far = state.darkField === "both" || state.darkField === "far";
    ["daa", "dab", "dac", "dad"].forEach((name) => (values[name] = near ? scaled(state.intensity) : 101));
    ["dea", "deb", "dec", "ded"].forEach((name) => (values[name] = far ? scaled(state.intensity) : 101));
  }

  if (state.mode === "ir") {
    ["iaa", "iab", "iac", "iad"].forEach((name) => (values[name] = scaled(state.ir)));
  }

  if (state.mode === "dome") values.ha = scaled(state.dome);
  if (state.mode === "aux") {
    values.ja = scaled(state.aux1);
    values.ka = scaled(state.aux2);
  }
  if (state.mode === "digital") {
    ["na", "oa", "pa", "qa"].forEach((name, index) => {
      values[name] = state.digital[index] ? 100 : 101;
    });
  }

  const lines = ["doAllDemo,", "fileSendVal,", "run,Run", `rings,${mode.ring}`, `wrgbselect,${wrgbSelect}`, `dfselect,${dfSelect}`];
  FIELD_NAMES.forEach((name) => lines.push(`${name},${values[name]}`));
  return `${lines.join("\n")}\n`;
}
