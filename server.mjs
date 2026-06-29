import express from "express";
import net from "node:net";
import { createServer } from "vite";

const HOST = process.env.DOALL_HOST || "192.168.1.200";
const PORT = Number(process.env.DOALL_PORT || 9019);
const HTTP_PORT = Number(process.env.PORT || 5178);

const app = express();
app.use(express.json({ limit: "256kb" }));

function sendToController(payload, timeoutMs = 1800) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let response = "";
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(response);
    };

    socket.setTimeout(timeoutMs);
    socket.connect(PORT, HOST, () => {
      socket.write(payload, "ascii");
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("ascii");
      if (response.length > 0) finish();
    });
    socket.on("timeout", () => finish());
    socket.on("error", finish);
    socket.on("close", () => finish());
  });
}

function checkController(timeoutMs = 900) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.connect(PORT, HOST, () => finish());
    socket.on("timeout", () => finish(new Error("Connection timed out")));
    socket.on("error", finish);
  });
}

app.get("/api/status", async (_req, res) => {
  try {
    await checkController();
    res.json({ ok: true, host: HOST, port: PORT, response: "tcp-open" });
  } catch (error) {
    res.status(503).json({ ok: false, host: HOST, port: PORT, error: error.message });
  }
});

app.post("/api/send", async (req, res) => {
  try {
    const payload = String(req.body?.payload || "");
    if (!payload.startsWith("doAllDemo,\nfileSendVal,")) {
      res.status(400).json({ ok: false, error: "Unexpected payload preamble" });
      return;
    }
    const response = await sendToController(payload);
    res.json({ ok: response.trim() === "1", response });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/api/strobe", async (req, res) => {
  try {
    const onPayload = String(req.body?.payload || "");
    const count = Math.max(1, Math.min(50, Number(req.body?.count || 5)));
    const intervalMs = Math.max(40, Math.min(2000, Number(req.body?.intervalMs || 180)));
    const offPayload = "doAllDemo,\nfileSendVal,\nstop,Stop\n";
    const events = [];

    for (let i = 0; i < count; i += 1) {
      events.push({ step: "on", response: await sendToController(onPayload) });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      events.push({ step: "off", response: await sendToController(offPayload) });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    res.json({ ok: events.every((event) => event.response.trim() === "1"), events });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "spa"
});

app.use(vite.middlewares);

app.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`DoAll GUI: http://127.0.0.1:${HTTP_PORT}`);
  console.log(`Controller: ${HOST}:${PORT}`);
});
