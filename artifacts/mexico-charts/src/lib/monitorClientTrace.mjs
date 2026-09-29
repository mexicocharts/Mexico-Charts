// Private build-only diagnostic. No credentials, URLs or response data enter
// this sink. Disabled builds do not change the request or its body reader.
import { MONITOR_PRIVATE_DIAGNOSTICS_ENABLED } from "./monitorProductMode.mjs";
const traces = new Map();
export function beginMonitorClientTrace(input) {
  if (!MONITOR_PRIVATE_DIAGNOSTICS_ENABLED) return undefined;
  const key = import.meta.env?.VITE_MONITOR_CLIENT_TRACE_KEY;
  if (!key || import.meta.env?.BASE_URL !== "/monitor-pro-private-preview/" ||
      input !== `/api/monitoring/dashboard/${key}`) return undefined;
  const start = performance.now();
  const rows = [];
  const id = crypto.randomUUID();
  let phase = "entry";
  const trace = {
    id,
    mark(event, detail = {}) {
      try {
        rows.push({ event, ms: +(performance.now() - start).toFixed(3), ...detail });
        // Visible private diagnostic evidence for the existing Safari session.
        let output = document.getElementById("monitor-private-client-timing");
        if (!output) {
          output = document.createElement("pre");
          output.id = "monitor-private-client-timing";
          output.setAttribute("aria-label", "Private Monitor client timing");
          output.style.cssText = "white-space:pre-wrap;background:#111;color:#eee;padding:16px;font-size:12px";
          document.body.appendChild(output);
        }
        output.textContent = `PRIVATE DIAGNOSTIC ${id}\n` + rows.slice(-80).map(row => JSON.stringify(row)).join("\n");
      } catch { /* Diagnostics never control serving. */ }
    },
    step(event, detail) { phase = event; trace.mark(event, detail); },
    activePhase: () => phase,
    async json(response) {
      trace.step("body_read_start");
      let text;
      try { text = await response.text(); }
      catch (error) { trace.mark("body_error", { abort: error?.name === "AbortError" }); throw error; }
      trace.step("body_read_end", { decodedCharacters: text.length });
      trace.step("json_parse_start");
      try { return JSON.parse(text); }
      finally {
        trace.step("json_parse_end");
        // Byte counting is diagnostic overhead, deliberately outside parse timing.
        trace.mark("decoded_body_size", { bytes: new TextEncoder().encode(text).byteLength });
      }
    },
  };
  traces.set(key, trace);
  trace.mark("request_entry", { at: new Date().toISOString() });
  return trace;
}

export function markMonitorPanelCommit(key) {
  const trace = traces.get(key);
  if (!trace || trace.committed) return;
  trace.committed = true;
  trace.step("react_panel_commit");
  // A paint opportunity, not a claim that pixels or artwork were inspected.
  requestAnimationFrame(() => requestAnimationFrame(() => trace.mark("panel_paint_opportunity")));
}
