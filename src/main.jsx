import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Cable,
  CircleStop,
  Cpu,
  Download,
  Play,
  Radio,
  RefreshCw,
  Save,
  SlidersHorizontal,
  SquareActivity,
  Zap
} from "lucide-react";
import { MODES, QUADRANTS, buildPayload, defaultState } from "./protocol.js";
import "./styles.css";

function App() {
  const [state, setState] = useState(defaultState);
  const [selectedStep, setSelectedStep] = useState("configure");
  const [status, setStatus] = useState({ connected: false, text: "Checking controller..." });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [pendingLivePayload, setPendingLivePayload] = useState(null);

  const activeMode = MODES.find((mode) => mode.id === state.mode) || MODES[0];
  const payload = useMemo(() => buildPayload(state), [state]);
  const lastLivePayload = useRef(payload);

  useEffect(() => {
    checkStatus(false);
  }, []);

  useEffect(() => {
    if (!pendingLivePayload) return;
    if (!status.connected || busy) return;

    const livePayload = pendingLivePayload;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: livePayload })
        });
        const body = await response.json();
        if (body.ok) lastLivePayload.current = livePayload;
        setPendingLivePayload((current) => (current === livePayload ? null : current));
        addLog(`Live update response: ${body.response || body.error}`, body.ok ? "success" : "error");
      } catch (error) {
        addLog(`Live update error: ${error.message}`, "error");
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [pendingLivePayload, status.connected, busy]);

  function addLog(message, kind = "info") {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((items) => [{ message, kind, timestamp }, ...items].slice(0, 8));
  }

  async function checkStatus(quiet = false) {
    try {
      const response = await fetch("/api/status");
      const body = await response.json();
      setStatus({
        connected: body.ok,
        text: body.ok ? `Connected to ${body.host}:${body.port}` : body.error || "Controller unavailable"
      });
      if (!quiet) addLog(body.ok ? "Controller handshake OK" : "Controller check failed", body.ok ? "success" : "error");
    } catch (error) {
      setStatus({ connected: false, text: error.message });
      if (!quiet) addLog(`Status error: ${error.message}`, "error");
    }
  }

  async function send(command, customPayload = payload) {
    setBusy(true);
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: command === "stop" ? buildPayload(state, "stop") : customPayload })
      });
      const body = await response.json();
      if (body.ok && command !== "stop") lastLivePayload.current = customPayload;
      addLog(`${command === "stop" ? "Stop" : "Run"} response: ${body.response || body.error}`, body.ok ? "success" : "error");
      return body;
    } finally {
      setBusy(false);
    }
  }

  async function strobe() {
    setBusy(true);
    try {
      const response = await fetch("/api/strobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, count: state.strobeCount, intervalMs: state.strobeMs })
      });
      const body = await response.json();
      addLog(`Strobe ${state.strobeCount}x response: ${body.ok ? "1" : body.error || "failed"}`, body.ok ? "success" : "error");
    } finally {
      setBusy(false);
    }
  }

  function update(key, value) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function queueLivePayload(nextPayload) {
    if (nextPayload === lastLivePayload.current) return;
    setPendingLivePayload(nextPayload);
  }

  function commitUpdate(key, value) {
    const nextState = { ...state, [key]: value };
    setState(nextState);
    queueLivePayload(buildPayload(nextState));
  }

  function commitTransform(transform) {
    const nextState = transform(state);
    setState(nextState);
    queueLivePayload(buildPayload(nextState));
  }

  function renderWorkspace() {
    if (selectedStep === "connect") {
      return <ConnectView status={status} busy={busy} onScan={() => checkStatus()} onStop={() => send("stop")} log={log} />;
    }

    if (selectedStep === "run") {
      return (
        <RunView
          state={state}
          activeMode={activeMode}
          payload={payload}
          busy={busy}
          status={status}
          update={update}
          commitUpdate={commitUpdate}
          commitTransform={commitTransform}
          onRun={() => send("run")}
          onStop={() => send("stop")}
          onStrobe={strobe}
          log={log}
        />
      );
    }

    return <ConfigureView state={state} update={update} commitUpdate={commitUpdate} commitTransform={commitTransform} activeMode={activeMode} status={status} />;
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <img src="/doall/SVL_LogoStacked_toolbar.png" alt="" />
          <span>DoAll</span>
        </div>
        {[
          ["connect", Cable, "Connect", "Controller"],
          ["configure", SlidersHorizontal, "Configure Event", "Triggers & Actions"],
          ["run", Play, "Run / Test", "Live Control"]
        ].map(([id, Icon, label, caption], index) => (
          <button key={id} className={`railButton ${selectedStep === id ? "selected" : ""}`} onClick={() => setSelectedStep(id)}>
            <b>{index + 1}</b>
            <Icon size={19} />
            <span>{label}</span>
            <small>{caption}</small>
          </button>
        ))}
      </aside>

      <main className="shell">
        <header className="topbar">
          <div className="topBrand">
            <img src="/doall/logo_50px_v2.png" alt="" />
            <strong>DoAll Light Controller</strong>
          </div>
          <div>
            <h1>Controller IP</h1>
            <p>192.168.1.200</p>
          </div>
          <div>
            <h1>Firmware</h1>
            <p>vX.X.X</p>
          </div>
          <div className="statusCluster">
            <span className={`statusDot ${status.connected ? "ok" : "bad"}`} />
            <span>{status.connected ? "DLM Online" : "DLM Offline"}</span>
            <button className="iconButton" onClick={() => checkStatus()} title="Scan controller">
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {renderWorkspace()}

        <CommandBar
          step={selectedStep}
          state={state}
          status={status}
          busy={busy}
          log={log}
          update={update}
          onScan={() => checkStatus()}
          onRun={() => send("run")}
          onStop={() => send("stop")}
          onStrobe={strobe}
          onSave={() => addLog("Preset stored in browser state", "info")}
          onDeploy={() => addLog("Deploy is disabled for quick runtime GUI", "warn")}
        />
      </main>
    </div>
  );
}

function ConfigureView({ state, update, commitUpdate, commitTransform, activeMode, status }) {
  return (
    <section className="workspace">
      <DiagramPanel state={state} commitUpdate={commitUpdate} commitTransform={commitTransform} activeMode={activeMode} />
      <InspectorPanel state={state} update={update} commitUpdate={commitUpdate} commitTransform={commitTransform} status={status} />
    </section>
  );
}

function ConnectView({ status, busy, onScan, onStop, log }) {
  return (
    <section className="stepWorkspace connectGrid">
      <section className="connectPanel">
        <div className="panelHeader">
          <div>
            <h2>Controller Connection</h2>
            <p>{status.text}</p>
          </div>
          <Cable size={22} />
        </div>

        <div className={`statusHero ${status.connected ? "online" : "offline"}`}>
          <span className={`statusDot ${status.connected ? "ok" : "bad"}`} />
          <strong>{status.connected ? "DLM Online" : "DLM Offline"}</strong>
          <small>{status.connected ? "TCP endpoint is accepting commands" : "No active controller connection"}</small>
        </div>

        <div className="infoRows">
          <div>
            <span>Controller IP</span>
            <strong>192.168.1.200</strong>
          </div>
          <div>
            <span>TCP Port</span>
            <strong>9019</strong>
          </div>
          <div>
            <span>Command Protocol</span>
            <strong>doAllDemo</strong>
          </div>
        </div>

        <div className="panelActions">
          <button className="primary" onClick={onScan} disabled={busy}>
            <RefreshCw size={18} />
            Scan Controller
          </button>
          <button onClick={onStop} disabled={busy || !status.connected}>
            <CircleStop size={18} />
            Safe Stop
          </button>
        </div>
      </section>

      <section className="connectPanel">
        <div className="panelHeader">
          <div>
            <h2>Connection Log</h2>
            <p>Latest command responses</p>
          </div>
          <SquareActivity size={22} />
        </div>
        <CommandLog log={log} expanded />
      </section>
    </section>
  );
}

function RunView({ state, activeMode, payload, busy, status, update, commitUpdate, commitTransform, onRun, onStop, onStrobe, log }) {
  const payloadLines = payload.trim().split("\n");

  return (
    <section className="stepWorkspace runtimeGrid">
      <DiagramPanel state={state} commitUpdate={commitUpdate} commitTransform={commitTransform} activeMode={activeMode} compact />

      <aside className="runtimePanel">
        <div className="panelHeader tight">
          <div>
            <h2>Run / Test</h2>
            <p>{status.text}</p>
          </div>
          <Play size={21} />
        </div>

        <div className="runtimeActions">
          <button className="primary" onClick={onRun} disabled={busy || !status.connected}>
            <Play size={19} />
            Run Event
          </button>
          <button onClick={onStop} disabled={busy || !status.connected}>
            <CircleStop size={19} />
            Stop
          </button>
          <button onClick={onStrobe} disabled={busy || !status.connected}>
            <Zap size={19} />
            Strobe
          </button>
        </div>

        <div className="runSettings">
          <label>
            Strobe Count
            <input type="number" min="1" max="50" value={state.strobeCount} onChange={(event) => update("strobeCount", event.target.value)} />
          </label>
          <label>
            Interval ms
            <input type="number" min="40" max="2000" value={state.strobeMs} onChange={(event) => update("strobeMs", event.target.value)} />
          </label>
        </div>

        <div className="summaryRows">
          <div>
            <span>Mode</span>
            <strong>{activeMode.label}</strong>
          </div>
          <div>
            <span>Runtime Ring</span>
            <strong>rings,{activeMode.ring}</strong>
          </div>
          <div>
            <span>Solid Color</span>
            <strong>{state.activeColor}</strong>
          </div>
          <div>
            <span>Intensity</span>
            <strong>{state.intensity}</strong>
          </div>
        </div>

        <pre className="payloadPreview">{payloadLines.slice(0, 16).join("\n")}</pre>

        <CommandLog log={log} expanded />
      </aside>
    </section>
  );
}

function DiagramPanel({ state, commitUpdate, commitTransform, activeMode, compact = false }) {
  return (
    <section className={`diagramPanel ${compact ? "compact" : ""}`}>
      <div className="panelHeader">
        <div>
          <h2>Light Preview</h2>
          <p>Top view / live runtime event</p>
        </div>
        <div className="modeChip">
          <img src={`/doall/${activeMode.icon}`} alt="" />
          <span>rings,{activeMode.ring}</span>
        </div>
      </div>

      <div className={`doallDiagram ${state.mode}`}>
        <div className="ringArt" />
        {QUADRANTS.map((label, index) => (
          <button
            key={label}
            className={`quadrant q${index + 1} ${state.quadrants[index] ? "enabled" : ""}`}
            onClick={() =>
              commitTransform((current) => ({
                ...current,
                quadrants: current.quadrants.map((item, itemIndex) => (itemIndex === index ? !item : item))
              }))
            }
            title={`Quadrant ${index + 1}`}
          >
            {label}
          </button>
        ))}
        <div className="centerMode">
          <img src={`/doall/${activeMode.icon}`} alt="" />
          <strong>{state.mode === "dome" ? "Dome" : state.mode === "ir" ? "IR" : "DoAll"}</strong>
        </div>
      </div>

      <div className="quickModes">
        {MODES.map((mode) => (
          <button key={mode.id} className={state.mode === mode.id ? "selected" : ""} onClick={() => commitUpdate("mode", mode.id)}>
            <img src={`/doall/${mode.icon}`} alt="" />
            <span>{mode.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function InspectorPanel({ state, update, commitUpdate, commitTransform, status }) {
  const intensityActive = state.mode === "solid" || state.mode === "darkfield";

  return (
    <aside className="inspector">
      <div className="panelHeader tight">
        <div>
          <h2>Light Mode</h2>
          <p>{status.text}</p>
        </div>
        <Cpu size={20} />
      </div>

      <div className="modeList">
        {MODES.map((mode) => (
          <button key={mode.id} className={state.mode === mode.id ? "selected" : ""} onClick={() => commitUpdate("mode", mode.id)}>
            <span className="radioMark" />
            <img src={`/doall/${mode.icon}`} alt="" />
            <span>
              <strong>{mode.label}</strong>
              <small>{mode.id === "dome" ? "Diffuse dome illumination" : mode.id === "darkfield" ? "Near / far low-angle light" : mode.id === "solid" ? "Independent colors per quadrant" : "Runtime output control"}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="sectionLabel">Output Controls</div>

      <Segmented
        label="Solid color"
        value={state.activeColor}
        options={[
          ["white", "White"],
          ["red", "Red"],
          ["green", "Green"],
          ["blue", "Blue"]
        ]}
        onChange={(value) => commitUpdate("activeColor", value)}
        disabled={state.mode !== "solid"}
      />

      <Slider label="Intensity" value={state.intensity} onChange={(value) => update("intensity", value)} onCommit={(value) => commitUpdate("intensity", value)} disabled={!intensityActive} />
      <Slider label="White" value={state.white} onChange={(value) => update("white", value)} onCommit={(value) => commitUpdate("white", value)} disabled={state.mode !== "mixed"} />
      <Slider label="Red" value={state.red} onChange={(value) => update("red", value)} onCommit={(value) => commitUpdate("red", value)} disabled={state.mode !== "mixed"} />
      <Slider label="Green" value={state.green} onChange={(value) => update("green", value)} onCommit={(value) => commitUpdate("green", value)} disabled={state.mode !== "mixed"} />
      <Slider label="Blue" value={state.blue} onChange={(value) => update("blue", value)} onCommit={(value) => commitUpdate("blue", value)} disabled={state.mode !== "mixed"} />
      <Slider label="Dome" value={state.dome} onChange={(value) => update("dome", value)} onCommit={(value) => commitUpdate("dome", value)} disabled={state.mode !== "dome"} />
      <Slider label="IR" value={state.ir} onChange={(value) => update("ir", value)} onCommit={(value) => commitUpdate("ir", value)} disabled={state.mode !== "ir"} />

      <Segmented
        label="Dark field"
        value={state.darkField}
        options={[
          ["both", "Both"],
          ["near", "Near"],
          ["far", "Far"]
        ]}
        onChange={(value) => commitUpdate("darkField", value)}
        disabled={state.mode !== "darkfield"}
      />

      <Slider label="Aux 1" value={state.aux1} onChange={(value) => update("aux1", value)} onCommit={(value) => commitUpdate("aux1", value)} disabled={state.mode !== "aux"} />
      <Slider label="Aux 2" value={state.aux2} onChange={(value) => update("aux2", value)} onCommit={(value) => commitUpdate("aux2", value)} disabled={state.mode !== "aux"} />

      <div className="digitalRows">
        {["Out 5", "Out 6", "Out 7", "Out 8"].map((label, index) => (
          <label key={label} className={state.mode !== "digital" ? "disabled" : ""}>
            <input
              type="checkbox"
              checked={state.digital[index]}
              disabled={state.mode !== "digital"}
              onChange={() =>
                commitTransform((current) => ({
                  ...current,
                  digital: current.digital.map((item, itemIndex) => (itemIndex === index ? !item : item))
                }))
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}

function CommandBar({ step, state, status, busy, log, update, onScan, onRun, onStop, onStrobe, onSave, onDeploy }) {
  const showStrobe = step !== "connect";
  const showPreset = step === "configure";

  return (
    <footer className={`commandBar ${step}`}>
      <div className="actionGroup">
        <button onClick={onScan} disabled={busy}>
          <Radio size={18} />
          Scan
        </button>
        {step !== "connect" && (
          <button className="primary" onClick={onRun} disabled={busy || !status.connected}>
            <Play size={18} />
            Run
          </button>
        )}
        <button onClick={onStop} disabled={busy || !status.connected}>
          <CircleStop size={18} />
          Stop
        </button>
        {showStrobe && (
          <button onClick={onStrobe} disabled={busy || !status.connected}>
            <Zap size={18} />
            Strobe
          </button>
        )}
        {showPreset && (
          <>
            <button onClick={onSave}>
              <Save size={18} />
              Save Preset
            </button>
            <button onClick={onDeploy}>
              <Download size={18} />
              Deploy
            </button>
          </>
        )}
      </div>

      <div className={`strobeControls ${showStrobe ? "" : "hiddenControl"}`}>
        <label>
          Count
          <input type="number" min="1" max="50" value={state.strobeCount} onChange={(event) => update("strobeCount", event.target.value)} />
        </label>
        <label>
          ms
          <input type="number" min="40" max="2000" value={state.strobeMs} onChange={(event) => update("strobeMs", event.target.value)} />
        </label>
      </div>

      <CommandLog log={log} />
    </footer>
  );
}

function CommandLog({ log, expanded = false }) {
  return (
    <div className={`log ${expanded ? "expanded" : ""}`}>
      {log.length === 0 ? (
        <span className="emptyLog">No commands sent yet</span>
      ) : (
        log.map((item) => (
          <span key={`${item.timestamp}-${item.message}`} className={item.kind}>
            {item.timestamp} {item.message}
          </span>
        ))
      )}
    </div>
  );
}

function Slider({ label, value, onChange, onCommit, disabled = false }) {
  function commit(event) {
    onCommit?.(event.currentTarget.value);
  }

  return (
    <label className={`sliderRow ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onPointerUp={commit}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter"].includes(event.key)) commit(event);
        }}
      />
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(event);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function Segmented({ label, value, options, onChange, disabled = false }) {
  return (
    <div className={`segmentedBlock ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <div className="segmented">
        {options.map(([id, text]) => (
          <button key={id} disabled={disabled} className={value === id ? "selected" : ""} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
