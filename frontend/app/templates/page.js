"use client";

import {useState, useEffect, useCallback} from "react";
import {useAuth} from "@/lib/AuthContext";
import * as api from "@/lib/api";

export default function TemplatesPage() {
  const {isAdmin} = useAuth();

  const [templates, setTemplates] = useState([]);
  const [models, setModels] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    model_id: "",
    threshold: 70,
    integration_ids: [],
    line_name: "",
    camera_type: "",
    camera_ids: "",
    trigger_type: "manual",
    plc_config: {
      plc_address: "",
      signal_register: "",
      result_register: "",
      protocol: "modbus_tcp",
    },
  });

  const loadData = useCallback(async () => {
    try {
      const [tmpls, mdls, intgs] = await Promise.all([
        api.listTemplates(),
        api.fetchInspectionModels(),
        api.listIntegrations(),
      ]);
      setTemplates(tmpls || []);
      setModels(mdls || []);
      setIntegrations(intgs || []);
    } catch (e) {
      console.error("Failed to load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      model_id: "",
      threshold: 70,
      integration_ids: [],
      line_name: "",
      camera_type: "",
      camera_ids: "",
      trigger_type: "manual",
      plc_config: {
        plc_address: "",
        signal_register: "",
        result_register: "",
        protocol: "modbus_tcp",
      },
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = {
      name: form.name,
      description: form.description,
      model_id: form.model_id || null,
      threshold: form.threshold / 100,
      integration_ids: form.integration_ids,
      line_name: form.line_name,
      camera_type: form.camera_type || null,
      camera_ids: form.camera_ids
        ? form.camera_ids
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      trigger_type: form.trigger_type,
    };
    if (form.trigger_type === "plc_signal") {
      body.plc_config = form.plc_config;
    } else {
      body.plc_config = null;
    }
    try {
      if (editingId) {
        await api.updateTemplate(editingId, body);
      } else {
        await api.createTemplate(body);
      }
      resetForm();
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (t) => {
    setForm({
      name: t.name,
      description: t.description || "",
      model_id: t.model_id || "",
      threshold: Math.round((t.threshold || 0.7) * 100),
      integration_ids: t.integration_ids || [],
      line_name: t.line_name || "",
      camera_type: t.camera_type || "",
      camera_ids: Array.isArray(t.camera_ids) ? t.camera_ids.join(", ") : "",
      trigger_type: t.trigger_type || "manual",
      plc_config: {
        plc_address: t.plc_config?.plc_address || "",
        signal_register: t.plc_config?.signal_register || "",
        result_register: t.plc_config?.result_register || "",
        protocol: t.plc_config?.protocol || "modbus_tcp",
      },
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    try {
      await api.deleteTemplate(id);
      loadData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleIntegration = (intgId) => {
    setForm((p) => ({
      ...p,
      integration_ids: p.integration_ids.includes(intgId)
        ? p.integration_ids.filter((id) => id !== intgId)
        : [...p.integration_ids, intgId],
    }));
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <span
          className="material-symbols-outlined text-[64px] mb-4"
          style={{color: "var(--clr-error)", opacity: 0.8}}>
          gpp_bad
        </span>
        <h2 className="text-xl font-bold" style={{color: "var(--clr-text)"}}>
          Access Denied
        </h2>
        <p className="mt-2 text-sm" style={{color: "var(--clr-text-muted)"}}>
          Only administrators can manage templates.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color: "var(--clr-text)"}}>
            Inspection Templates
          </h1>
          <p className="text-sm mt-1" style={{color: "var(--clr-text-sub)"}}>
            Save preset configurations to quickly load on the Live Inspection
            page.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary text-xs">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Template
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="vv-card p-6 animate-fade-in">
          <h2
            className="text-base font-semibold mb-4 flex items-center gap-2"
            style={{color: "var(--clr-text)"}}>
            <span className="material-symbols-outlined">
              {editingId ? "edit" : "bookmark_add"}
            </span>
            {editingId ? "Edit Template" : "Create New Template"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{color: "var(--clr-text-sub)"}}>
                Template Name
              </label>
              <input
                required
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{
                  background: "var(--clr-surface)",
                  borderColor: "var(--clr-border)",
                  color: "var(--clr-text)",
                }}
                value={form.name}
                onChange={(e) => setForm((p) => ({...p, name: e.target.value}))}
                placeholder="e.g. Car Door Inspection"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{color: "var(--clr-text-sub)"}}>
                Line Name
              </label>
              <input
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{
                  background: "var(--clr-surface)",
                  borderColor: "var(--clr-border)",
                  color: "var(--clr-text)",
                }}
                value={form.line_name}
                onChange={(e) =>
                  setForm((p) => ({...p, line_name: e.target.value}))
                }
                placeholder="e.g. Line Alpha"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{color: "var(--clr-text-sub)"}}>
                AI Model
              </label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{
                  background: "var(--clr-surface)",
                  borderColor: "var(--clr-border)",
                  color: "var(--clr-text)",
                }}
                value={form.model_id}
                onChange={(e) =>
                  setForm((p) => ({...p, model_id: e.target.value}))
                }>
                <option value="">— Select Model —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} v{m.version} ({m.task_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{color: "var(--clr-text-sub)"}}>
                Confidence Threshold:{" "}
                <strong style={{color: "var(--clr-accent)"}}>
                  {form.threshold}%
                </strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                className="w-full mt-1"
                value={form.threshold}
                onChange={(e) =>
                  setForm((p) => ({...p, threshold: Number(e.target.value)}))
                }
              />
            </div>

            {/* Camera Assignment Section */}
            <div className="sm:col-span-2 mt-2">
              <h3
                className="text-sm font-semibold flex items-center gap-2 mb-3"
                style={{color: "var(--clr-text)"}}>
                <span className="material-symbols-outlined text-[18px]">
                  videocam
                </span>
                Camera Assignment
              </h3>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-4 rounded-md"
                style={{borderColor: "var(--clr-border)"}}>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1"
                    style={{color: "var(--clr-text-sub)"}}>
                    Camera Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    style={{
                      background: "var(--clr-surface)",
                      borderColor: "var(--clr-border)",
                      color: "var(--clr-text)",
                    }}
                    value={form.camera_type}
                    onChange={(e) =>
                      setForm((p) => ({...p, camera_type: e.target.value}))
                    }>
                    <option value="">— Select Type —</option>
                    <option value="webcam">Webcam</option>
                    <option value="usb">USB Camera</option>
                    <option value="ethernet">Ethernet / IP Camera</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1"
                    style={{color: "var(--clr-text-sub)"}}>
                    Camera IDs
                  </label>
                  <input
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    style={{
                      background: "var(--clr-surface)",
                      borderColor: "var(--clr-border)",
                      color: "var(--clr-text)",
                    }}
                    value={form.camera_ids}
                    onChange={(e) =>
                      setForm((p) => ({...p, camera_ids: e.target.value}))
                    }
                    placeholder="e.g. cam_0, cam_line3_02"
                  />
                </div>
              </div>
            </div>

            {/* PLC Trigger Section */}
            <div className="sm:col-span-2 mt-2">
              <h3
                className="text-sm font-semibold flex items-center gap-2 mb-3"
                style={{color: "var(--clr-text)"}}>
                <span className="material-symbols-outlined text-[18px]">
                  bolt
                </span>
                PLC Trigger
              </h3>
              <div
                className="border p-4 rounded-md flex flex-col gap-4"
                style={{borderColor: "var(--clr-border)"}}>
                <div className="w-full sm:w-1/2 pr-2">
                  <label
                    className="block text-xs font-semibold mb-1"
                    style={{color: "var(--clr-text-sub)"}}>
                    Trigger Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    style={{
                      background: "var(--clr-surface)",
                      borderColor: "var(--clr-border)",
                      color: "var(--clr-text)",
                    }}
                    value={form.trigger_type}
                    onChange={(e) =>
                      setForm((p) => ({...p, trigger_type: e.target.value}))
                    }>
                    <option value="manual">Manual</option>
                    <option value="plc_signal">PLC Signal</option>
                  </select>
                </div>
                {form.trigger_type === "plc_signal" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label
                        className="block text-xs font-semibold mb-1"
                        style={{color: "var(--clr-text-sub)"}}>
                        PLC Address
                      </label>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        style={{
                          background: "var(--clr-surface)",
                          borderColor: "var(--clr-border)",
                          color: "var(--clr-text)",
                        }}
                        value={form.plc_config.plc_address}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            plc_config: {
                              ...p.plc_config,
                              plc_address: e.target.value,
                            },
                          }))
                        }
                        placeholder="10.0.4.21:502"
                      />
                    </div>
                    <div>
                      <label
                        className="block text-xs font-semibold mb-1"
                        style={{color: "var(--clr-text-sub)"}}>
                        Protocol
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        style={{
                          background: "var(--clr-surface)",
                          borderColor: "var(--clr-border)",
                          color: "var(--clr-text)",
                        }}
                        value={form.plc_config.protocol}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            plc_config: {
                              ...p.plc_config,
                              protocol: e.target.value,
                            },
                          }))
                        }>
                        <option value="modbus_tcp">Modbus TCP</option>
                        <option value="modbus_rtu">Modbus RTU</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="block text-xs font-semibold mb-1"
                        style={{color: "var(--clr-text-sub)"}}>
                        Signal Register
                      </label>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        style={{
                          background: "var(--clr-surface)",
                          borderColor: "var(--clr-border)",
                          color: "var(--clr-text)",
                        }}
                        value={form.plc_config.signal_register}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            plc_config: {
                              ...p.plc_config,
                              signal_register: e.target.value,
                            },
                          }))
                        }
                        placeholder="40001"
                      />
                    </div>
                    <div>
                      <label
                        className="block text-xs font-semibold mb-1"
                        style={{color: "var(--clr-text-sub)"}}>
                        Result Register
                      </label>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        style={{
                          background: "var(--clr-surface)",
                          borderColor: "var(--clr-border)",
                          color: "var(--clr-text)",
                        }}
                        value={form.plc_config.result_register}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            plc_config: {
                              ...p.plc_config,
                              result_register: e.target.value,
                            },
                          }))
                        }
                        placeholder="40002"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 mt-2">
              <label
                className="block text-xs font-semibold mb-1"
                style={{color: "var(--clr-text-sub)"}}>
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm resize-none h-16"
                style={{
                  background: "var(--clr-surface)",
                  borderColor: "var(--clr-border)",
                  color: "var(--clr-text)",
                }}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({...p, description: e.target.value}))
                }
                placeholder="Optional notes about this template..."
              />
            </div>

            {integrations.length > 0 && (
              <div className="sm:col-span-2">
                <label
                  className="block text-xs font-semibold mb-2"
                  style={{color: "var(--clr-text-sub)"}}>
                  Linked Integrations
                </label>
                <div className="flex flex-wrap gap-2">
                  {integrations.map((intg) => {
                    const selected = form.integration_ids.includes(intg.id);
                    return (
                      <button
                        key={intg.id}
                        type="button"
                        onClick={() => toggleIntegration(intg.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                        style={{
                          background: selected
                            ? "var(--clr-accent)"
                            : "var(--clr-surface)",
                          borderColor: selected
                            ? "var(--clr-accent)"
                            : "var(--clr-border)",
                          color: selected ? "#fff" : "var(--clr-text)",
                        }}>
                        <span className="material-symbols-outlined text-[14px] align-middle mr-1">
                          {intg.type === "webhook" ? "webhook" : "sensors"}
                        </span>
                        {intg.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="sm:col-span-2 flex gap-2 pt-2">
              <button type="submit" className="btn-primary text-xs">
                <span className="material-symbols-outlined text-[16px]">
                  save
                </span>
                {editingId ? "Update" : "Save Template"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-outline text-xs">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Template Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="vv-card p-5 h-36 animate-pulse"
              style={{background: "var(--clr-surface-low)"}}
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="vv-card p-10 text-center">
          <span
            className="material-symbols-outlined text-[48px] block mb-3"
            style={{color: "var(--clr-border)"}}>
            bookmark
          </span>
          <p
            className="text-sm font-medium"
            style={{color: "var(--clr-text-muted)"}}>
            No templates created yet.
          </p>
          <p className="text-xs mt-1" style={{color: "var(--clr-text-muted)"}}>
            Create a template to save model + threshold + integrations as a
            reusable preset.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="vv-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3
                    className="text-sm font-bold"
                    style={{color: "var(--clr-text)"}}>
                    {t.name}
                  </h3>
                  {t.line_name && (
                    <p
                      className="text-[10px] mt-0.5"
                      style={{color: "var(--clr-text-muted)"}}>
                      Line: {t.line_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(t)}
                    className="p-1 rounded hover:bg-[var(--clr-surface-low)]"
                    style={{color: "var(--clr-text-muted)"}}>
                    <span className="material-symbols-outlined text-[16px]">
                      edit
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="p-1 rounded hover:bg-red-50"
                    style={{color: "var(--clr-error)"}}>
                    <span
                      className={`material-symbols-outlined text-[16px] ${deleting === t.id ? "animate-spin" : ""}`}>
                      {deleting === t.id ? "progress_activity" : "delete"}
                    </span>
                  </button>
                </div>
              </div>

              {t.description && (
                <p
                  className="text-xs line-clamp-2"
                  style={{color: "var(--clr-text-sub)"}}>
                  {t.description}
                </p>
              )}

              <div
                className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]"
                style={{color: "var(--clr-text-muted)"}}>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    deployed_code
                  </span>
                  {t.model_name || "No model"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    tune
                  </span>
                  {Math.round((t.threshold || 0.7) * 100)}%
                </span>
              </div>

              {t.integrations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.integrations.map((intg) => (
                    <span
                      key={intg.id}
                      className="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1"
                      style={{
                        borderColor: "var(--clr-border)",
                        color: "var(--clr-text-sub)",
                      }}>
                      <span className="material-symbols-outlined text-[12px]">
                        {intg.type === "webhook" ? "webhook" : "sensors"}
                      </span>
                      {intg.name}
                    </span>
                  ))}
                </div>
              )}

              <p
                className="text-[10px] mt-auto"
                style={{color: "var(--clr-text-muted)"}}>
                Created by {t.created_by || "admin"} ·{" "}
                {t.created_at
                  ? new Date(t.created_at).toLocaleDateString()
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
