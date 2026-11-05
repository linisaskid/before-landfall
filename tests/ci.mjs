/* Runs the browser tests in headless Chrome and exits with 0 when every test passes,
 * so GitHub Actions (or any CI) can mark a push or pull request green or red.
 * Plain Node, no packages: it starts Chrome with its DevTools port open, loads
 * tests/index.html and reads window.__testResults when the run finishes.
 *
 *   python3 -m http.server 8123 &
 *   node tests/ci.mjs http://127.0.0.1:8123/tests/ [--grep=calculator]
 *
 * Needs Node 22 or newer (for the built-in WebSocket) and Chrome or Chromium.
 * Set CHROME_PATH if Chrome is not found on its own.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const RUN_TIMEOUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const grep = (args.find((arg) => arg.startsWith("--grep=")) || "").slice("--grep=".length);
const target = new URL(args.find((arg) => !arg.startsWith("--")) || "http://127.0.0.1:8123/tests/");
if (grep) target.searchParams.set("grep", grep);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hasExited = (child) => child.exitCode !== null || child.signalCode !== null;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const apps = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
  const onPath = (process.env.PATH || "").split(delimiter).flatMap((dir) => names.map((name) => join(dir, name)));
  return apps.concat(onPath).find((path) => existsSync(path));
}

// The local server may still be starting when this script runs.
async function waitForServer(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch (error) {}
    await sleep(500);
  }
  throw new Error("Nothing is serving " + url + ". Start a server first, e.g. python3 -m http.server 8123");
}

// Chrome writes the port it picked to DevToolsActivePort in its profile folder.
async function waitForDevToolsPort(profile, chrome) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (hasExited(chrome)) throw new Error("Chrome exited (" + (chrome.signalCode || "code " + chrome.exitCode) + ") before it started");
    try {
      const [port] = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n");
      if (port) return Number(port);
    } catch (error) {}
    await sleep(100);
  }
  throw new Error("Chrome did not open its DevTools port within 10 s");
}

// A minimal DevTools Protocol client: send a command, get its result back.
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method && listeners.has(message.method)) {
      listeners.get(message.method)(message.params);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const on = (method, handler) => listeners.set(method, handler);
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({ send, on, close: () => socket.close() }), { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to Chrome at " + url)), { once: true });
  });
}

async function evaluate(client, expression) {
  const { result, exceptionDetails } = await client.send("Runtime.evaluate", { expression, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

async function runTests(port) {
  const targets = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
  const page = targets.find((item) => item.type === "page");
  if (!page) throw new Error("Chrome has no open page to drive");
  const client = await connect(page.webSocketDebuggerUrl);
  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    console.log("  page error: " + ((exceptionDetails.exception && exceptionDetails.exception.description) || exceptionDetails.text));
  });
  await client.send("Runtime.enable");
  await client.send("Page.navigate", { url: target.href });

  const deadline = Date.now() + RUN_TIMEOUT_MS;
  let lastSummary = "";
  while (Date.now() < deadline) {
    await sleep(500);
    let state;
    try {
      state = await evaluate(client, '({ summary: (document.getElementById("summary") || {}).textContent || "", results: window.__testResults || null })');
    } catch (error) {
      continue; // the page is between navigations
    }
    if (state.summary !== lastSummary) {
      lastSummary = state.summary;
      if (!state.results) console.log(state.summary);
    }
    if (state.results) {
      client.close();
      return state.results;
    }
    if (/^Could not load/.test(state.summary)) throw new Error(state.summary);
  }
  client.close();
  throw new Error("The tests did not finish within " + RUN_TIMEOUT_MS / 60000 + " minutes. Last status: " + lastSummary);
}

function report(results) {
  console.log("");
  results.results.forEach((result) => {
    console.log((result.pass ? "  ✓ " : "  ✗ ") + result.name + " (" + result.ms + " ms)");
    if (!result.pass) console.log(result.message.split("\n").map((line) => "      " + line).join("\n"));
  });
  console.log("");
  console.log((results.failed ? "FAILED: " + results.failed + " of " : "PASSED: all ") + results.total + " tests in " + results.seconds + " s");
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to its executable.");
  await waitForServer(target.href);

  const profile = await mkdtemp(join(tmpdir(), "before-landfall-tests-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "--no-first-run",
    "--no-default-browser-check",
    // A wide window keeps the page under test at a readable scale beside the results.
    "--window-size=1600,1000",
    // CI machines have no GPU: draw the hero storm's WebGL with Chrome's software renderer.
    "--enable-unsafe-swiftshader",
    // Timers and animation frames must keep full speed for the timing-based tests.
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    const port = await waitForDevToolsPort(profile, chrome);
    console.log("Running " + target.href + " in " + chromePath);
    const results = await runTests(port);
    report(results);
    return results.total > 0 && results.failed === 0;
  } finally {
    if (!hasExited(chrome)) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await exited;
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().then(
  (passed) => process.exit(passed ? 0 : 1),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
