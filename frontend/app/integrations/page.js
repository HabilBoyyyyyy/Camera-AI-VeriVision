"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import * as api from "@/lib/api";

const BASE_URL = "http://localhost:8000";

export default function IntegrationsPage() {
  const { isAdmin } = useAuth();

  const [integrations, setIntegrations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    type: "webhook",
    trigger_on: "NG",
    model_id: "",
    is_active: true,
    url: "",
    broker: "localhost",
    port: "1883",
    topic: "verivision/inspection",
  });

  const logEndRef = useRef(null);

  // ── Load data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [intgs, logData] = await Promise.all([
        api.listIntegrations(),
        api.getIntegrationLogs(50),
      ]);
      setIntegrations(intgs || []);
      setLogs(logData || []);
    } catch (e) {
      console.error("Failed to load integrations:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── SSE for live events ──────────────────────────────
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource(`${BASE_URL}/api/integrations/events`, {
        withCredentials: true,
      });
      eventSource.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          setLiveEvents((prev) => [...prev.slice(-49), evt]);
        } catch {}
      };
      eventSource.onerror = () => {
        // Reconnect silently
      };
    } catch {}
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Auto-scroll simulator log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  // ── Handlers ────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      name: "",
      type: "webhook",
      trigger_on: "NG",
      model_id: "",
      is_active: true,
      url: "",
      broker: "localhost",
      port: "1883",
      topic: "verivision/inspection",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const config =
      form.type === "webhook"
        ? { url: form.url }
        : { broker: form.broker, port: parseInt(form.port), topic: form.topic };
    const body = {
      name: form.name,
      type: form.type,
      trigger_on: form.trigger_on,
      model_id: form.model_id || null,
      is_active: form.is_active,
      config,
    };

    try {
      if (editingId) {
        await api.updateIntegration(editingId, body);
      } else {
        await api.createIntegration(body);
      }
      resetForm();
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (intg) => {
    setForm({
      name: intg.name,
      type: intg.type,
      trigger_on: intg.trigger_on,
      model_id: intg.model_id || "",
      is_active: intg.is_active,
      url: intg.config?.url || "",
      broker: intg.config?.broker || "localhost",
      port: String(intg.config?.port || 1883),
      topic: intg.config?.topic || "verivision/inspection",
    });
    setEditingId(intg.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this integration?")) return;
    setDeleting(id);
    try {
      await api.deleteIntegration(id);
      loadData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id) => {
    setTesting(id);
    try {
      const res = await api.testIntegration(id);
      if (res.success) {
        // Will appear in the live log automatically
      } else {
        alert("Test failed: " + (res.error || "Unknown error"));
      }
    } catch (err) {
      alert("Test error: " + err.message);
    } finally {
      setTesting(null);
    }
  };

  const handleToggle = async (intg) => {
    try {
      await api.updateIntegration(intg.id, { is_active: !intg.is_active });
      loadData();
    } catch (err) {
      alert("Toggle failed: " + err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: "var(--clr-error)", opacity: 0.8 }}>gpp_bad</span>
        <h2 className="text-xl font-bold" style={{ color: "var(--clr-text)" }}>Access Denied</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--clr-text-muted)" }}>Only administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--clr-text)" }}>Integrations</h1>
          <p className="text-sm mt-1" style={{ color: "var(--clr-text-sub)" }}>
            Connect VeriVision to external systems via Webhooks or MQTT.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-xs"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Integration
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="vv-card p-6 animate-fade-in">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--clr-text)" }}>
            <span className="material-symbols-outlined">{editingId ? "edit" : "add_circle"}</span>
            {editingId ? "Edit Integration" : "Create New Integration"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Name</label>
              <input
                required
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Line Alpha Reject Webhook"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Type</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="webhook">Webhook (HTTP POST)</option>
                <option value="mqtt">MQTT Publish</option>
              </select>
            </div>

            {/* Trigger On */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Trigger When</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                value={form.trigger_on}
                onChange={(e) => setForm((p) => ({ ...p, trigger_on: e.target.value }))}
              >
                <option value="NG">Verdict is NG (Fail)</option>
                <option value="OK">Verdict is OK (Pass)</option>
                <option value="Uncertain">Verdict is Uncertain</option>
                <option value="any">Any Verdict</option>
              </select>
            </div>

            {/* Active toggle */}
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium" style={{ color: "var(--clr-text)" }}>Active</span>
              </label>
            </div>

            {/* Webhook-specific: URL */}
            {form.type === "webhook" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Webhook URL</label>
                <input
                  required
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://webhook.site/your-unique-url"
                />
              </div>
            )}

            {/* MQTT-specific: Broker, Port, Topic */}
            {form.type === "mqtt" && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>MQTT Broker</label>
                  <input
                    required
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                    value={form.broker}
                    onChange={(e) => setForm((p) => ({ ...p, broker: e.target.value }))}
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Port</label>
                  <input
                    required
                    type="number"
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                    value={form.port}
                    onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
                    placeholder="1883"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--clr-text-sub)" }}>Topic</label>
                  <input
                    required
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    style={{ background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)" }}
                    value={form.topic}
                    onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                    placeholder="verivision/inspection"
                  />
                </div>
              </>
            )}

            {/* Buttons */}
            <div className="sm:col-span-2 flex gap-2 pt-2">
              <button type="submit" className="btn-primary text-xs">
                <span className="material-symbols-outlined text-[16px]">save</span>
                {editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline text-xs">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Integration Cards + Simulator Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Integration Cards */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--clr-text-sub)" }}>
            Configured Integrations ({integrations.length})
          </h3>

          {loading ? (
            [1, 2].map((i) => (
              <div key={i} className="vv-card p-5 h-24 animate-pulse" style={{ background: "var(--clr-surface-low)" }} />
            ))
          ) : integrations.length === 0 ? (
            <div className="vv-card p-8 text-center">
              <span className="material-symbols-outlined text-[48px] block mb-3" style={{ color: "var(--clr-border)" }}>hub</span>
              <p className="text-sm font-medium" style={{ color: "var(--clr-text-muted)" }}>No integrations configured yet.</p>
              <p className="text-xs mt-1" style={{ color: "var(--clr-text-muted)" }}>Click "New Integration" to connect to external systems.</p>
            </div>
          ) : (
            integrations.map((intg) => (
              <div key={intg.id} className="vv-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Type Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: intg.type === "webhook"
                          ? "rgba(56, 139, 253, 0.15)"
                          : "rgba(163, 113, 247, 0.15)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[22px]"
                        style={{
                          color: intg.type === "webhook" ? "#388bfd" : "#a371f7",
                        }}
                      >
                        {intg.type === "webhook" ? "webhook" : "sensors"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate" style={{ color: "var(--clr-text)" }}>{intg.name}</h4>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase"
                          style={{
                            background: intg.is_active ? "rgba(22, 163, 74, 0.15)" : "rgba(140, 140, 140, 0.15)",
                            color: intg.is_active ? "var(--clr-success)" : "var(--clr-text-muted)",
                          }}
                        >
                          {intg.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono" style={{ color: "var(--clr-text-muted)" }}>
                          {intg.type === "webhook"
                            ? intg.config?.url || "No URL"
                            : `mqtt://${intg.config?.broker || "localhost"}:${intg.config?.port || 1883}/${intg.config?.topic || ""}`}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: "var(--clr-text-muted)" }}>
                        Triggers on: <strong>{intg.trigger_on === "any" ? "Any verdict" : intg.trigger_on}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTest(intg.id)}
                      disabled={testing === intg.id}
                      className="p-1.5 rounded transition-colors hover:bg-[var(--clr-surface-low)]"
                      title="Test fire"
                      style={{ color: "var(--clr-text-muted)" }}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${testing === intg.id ? "animate-spin" : ""}`}>
                        {testing === intg.id ? "progress_activity" : "play_arrow"}
                      </span>
                    </button>
                    <button
                      onClick={() => handleToggle(intg)}
                      className="p-1.5 rounded transition-colors hover:bg-[var(--clr-surface-low)]"
                      title={intg.is_active ? "Deactivate" : "Activate"}
                      style={{ color: intg.is_active ? "var(--clr-success)" : "var(--clr-text-muted)" }}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {intg.is_active ? "toggle_on" : "toggle_off"}
                      </span>
                    </button>
                    <button
                      onClick={() => handleEdit(intg)}
                      className="p-1.5 rounded transition-colors hover:bg-[var(--clr-surface-low)]"
                      title="Edit"
                      style={{ color: "var(--clr-text-muted)" }}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(intg.id)}
                      disabled={deleting === intg.id}
                      className="p-1.5 rounded transition-colors hover:bg-red-50"
                      title="Delete"
                      style={{ color: "var(--clr-error)" }}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${deleting === intg.id ? "animate-spin" : ""}`}>
                        {deleting === intg.id ? "progress_activity" : "delete"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Live Simulator Log Panel */}
        <div className="lg:col-span-2 flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--clr-text-sub)" }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live Event Monitor
            </span>
          </h3>

          <div
            className="vv-card flex-1 flex flex-col overflow-hidden"
            style={{ minHeight: 400, background: "#0d1117" }}
          >
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
              </div>
              <span className="text-[11px] font-mono ml-2" style={{ color: "#8b949e" }}>verivision-integration-monitor</span>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ color: "#c9d1d9" }}>
              {liveEvents.length === 0 ? (
                <div className="text-center py-8" style={{ color: "#484f58" }}>
                  <p>Waiting for integration events...</p>
                  <p className="mt-1 text-[10px]">Events will appear here when inspections trigger integrations.</p>
                  <p className="mt-1 text-[10px]">Tip: Click the ▶ button on an integration to test fire.</p>
                </div>
              ) : (
                liveEvents.map((evt, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <span style={{ color: "#484f58" }}>
                      [{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "—"}]
                    </span>
                    <span
                      style={{
                        color:
                          evt.status === "success"
                            ? "#3fb950"
                            : evt.status === "failed"
                            ? "#f85149"
                            : "#d29922",
                      }}
                    >
                      {evt.status === "success" ? "✓" : evt.status === "failed" ? "✗" : "⚡"}
                    </span>
                    <span>
                      <span style={{ color: "#79c0ff" }}>{evt.integration_name}</span>
                      {" "}
                      <span style={{ color: "#8b949e" }}>({evt.integration_type})</span>
                      {" → "}
                      <span
                        style={{
                          color:
                            evt.verdict === "NG"
                              ? "#f85149"
                              : evt.verdict === "OK"
                              ? "#3fb950"
                              : evt.verdict === "TEST"
                              ? "#d29922"
                              : "#8b949e",
                        }}
                      >
                        {evt.verdict}
                      </span>
                      {evt.confidence != null && (
                        <span style={{ color: "#8b949e" }}> ({(evt.confidence * 100).toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Event History */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--clr-text-sub)" }}>
              Recent Event History
            </h3>
            <div className="vv-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: "var(--clr-surface-low)" }}>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--clr-text-muted)" }}>Time</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--clr-text-muted)" }}>Integration</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--clr-text-muted)" }}>Verdict</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--clr-text-muted)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: "var(--clr-border)" }}>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-xs" style={{ color: "var(--clr-text-muted)" }}>
                          No events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      logs.slice(0, 10).map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2 text-[11px] font-mono" style={{ color: "var(--clr-text-muted)" }}>
                            {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium" style={{ color: "var(--clr-text)" }}>
                            {log.integration_name}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background:
                                  log.verdict === "NG"
                                    ? "rgba(186, 26, 26, 0.15)"
                                    : log.verdict === "OK"
                                    ? "rgba(22, 163, 74, 0.15)"
                                    : "rgba(210, 153, 34, 0.15)",
                                color:
                                  log.verdict === "NG"
                                    ? "var(--clr-error)"
                                    : log.verdict === "OK"
                                    ? "var(--clr-success)"
                                    : "var(--clr-warn)",
                              }}
                            >
                              {log.verdict}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: log.status === "success" ? "rgba(22, 163, 74, 0.15)" : "rgba(186, 26, 26, 0.15)",
                                color: log.status === "success" ? "var(--clr-success)" : "var(--clr-error)",
                              }}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
