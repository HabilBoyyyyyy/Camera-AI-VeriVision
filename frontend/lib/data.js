// ============================================================
// Camera AI — Mock Data Layer (Phase 1: Template-Based Classification)
// Supports: configurable templates, binary OK/NG classification,
// optional bounding box annotations, and chatbot Q&A
// ============================================================

// ---------- Defect Types (used for bounding box overlays when dataset supports it) ----------
export const defectTypes = [
  { id: "scratch", name: "Scratch", color: "#f97316" },
  { id: "crack", name: "Crack", color: "#ef4444" },
  { id: "dent", name: "Dent", color: "#eab308" },
  { id: "porosity", name: "Porosity", color: "#a855f7" },
  { id: "misalignment", name: "Misalignment", color: "#3b82f6" },
  { id: "corrosion", name: "Corrosion", color: "#78716c" },
];

// ---------- AI Models (Classification — MobileNet / ResNet via transfer learning) ----------
export const models = [
  {
    id: "model_mobilenet_v1",
    name: "MobileNetV2-ScratchDet",
    architecture: "MobileNetV2",
    task_type: "classification",
    accuracy: 94.2,
    precision: 93.8,
    recall: 91.5,
    f1_score: 92.6,
    file_size: "14 MB",
    trained_at: "2026-06-28T12:00:00Z",
    status: "active",
    dataset_size: 2400,
    epochs: 15,
    description: "Lightweight classifier for surface scratch detection. Optimized for real-time inference on edge devices.",
  },
  {
    id: "model_resnet50_v1",
    name: "ResNet50-DefectClassifier",
    architecture: "ResNet50",
    task_type: "classification",
    accuracy: 96.8,
    precision: 97.1,
    recall: 95.2,
    f1_score: 96.1,
    file_size: "98 MB",
    trained_at: "2026-07-01T10:00:00Z",
    status: "active",
    dataset_size: 4800,
    epochs: 20,
    description: "High-accuracy classifier using deep residual learning. Best accuracy but higher compute requirements.",
  },
  {
    id: "model_mobilenet_cast",
    name: "MobileNetV2-CastInspect",
    architecture: "MobileNetV2",
    task_type: "classification",
    accuracy: 91.5,
    precision: 90.8,
    recall: 89.3,
    f1_score: 90.0,
    file_size: "14 MB",
    trained_at: "2026-07-03T08:00:00Z",
    status: "active",
    dataset_size: 1800,
    epochs: 12,
    description: "Classifier trained on casting product images. Detects porosity and surface defects on cast metal parts.",
  },
];

// ---------- Inspection Templates (Section 9 JSON schema) ----------
export const templates = [
  {
    id: "tmpl_0001",
    name: "Bracket Scratch Inspection",
    description: "Detects surface scratches on metal brackets",
    is_active: true,
    created_at: "2026-07-03T14:00:00Z",
    input_source: { type: "webcam", device_id: 0 },
    preprocessing_steps: [
      { step_type: "resize", params: { width: 224, height: 224 } },
      { step_type: "normalize", params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } },
    ],
    inspection_step: {
      step_type: "classification",
      model_id: "model_mobilenet_v1",
      confidence_threshold: 0.80,
    },
    decision_rule: {
      pass_label: "OK",
      fail_label: "NG",
      min_confidence_to_pass: 0.80,
    },
    output_actions: [
      { action_type: "save_result", params: { store_image: true } },
      { action_type: "log_event", params: { log_level: "info" } },
    ],
  },
  {
    id: "tmpl_0002",
    name: "Casting Porosity Check",
    description: "Inspects cast aluminum parts for porosity and void defects",
    is_active: true,
    created_at: "2026-07-04T09:30:00Z",
    input_source: { type: "webcam", device_id: 0 },
    preprocessing_steps: [
      { step_type: "resize", params: { width: 224, height: 224 } },
      { step_type: "crop", params: { x: 30, y: 30, width: 400, height: 400 } },
      { step_type: "normalize", params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } },
    ],
    inspection_step: {
      step_type: "classification",
      model_id: "model_mobilenet_cast",
      confidence_threshold: 0.75,
    },
    decision_rule: {
      pass_label: "OK",
      fail_label: "NG",
      min_confidence_to_pass: 0.75,
    },
    output_actions: [
      { action_type: "save_result", params: { store_image: true } },
      { action_type: "log_event", params: { log_level: "info" } },
    ],
  },
  {
    id: "tmpl_0003",
    name: "Precision Surface QC",
    description: "High-confidence surface quality check for precision-machined components",
    is_active: true,
    created_at: "2026-07-05T16:00:00Z",
    input_source: { type: "webcam", device_id: 0 },
    preprocessing_steps: [
      { step_type: "resize", params: { width: 224, height: 224 } },
      { step_type: "normalize", params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } },
    ],
    inspection_step: {
      step_type: "classification",
      model_id: "model_resnet50_v1",
      confidence_threshold: 0.90,
    },
    decision_rule: {
      pass_label: "OK",
      fail_label: "NG",
      min_confidence_to_pass: 0.90,
    },
    output_actions: [
      { action_type: "save_result", params: { store_image: true } },
      { action_type: "log_event", params: { log_level: "warning" } },
    ],
  },
  {
    id: "tmpl_0004",
    name: "Weld Seam Inspection",
    description: "Checks weld quality on metal assemblies for cracks and porosity",
    is_active: false,
    created_at: "2026-07-02T11:00:00Z",
    input_source: { type: "webcam", device_id: 0 },
    preprocessing_steps: [
      { step_type: "resize", params: { width: 224, height: 224 } },
    ],
    inspection_step: {
      step_type: "classification",
      model_id: "model_resnet50_v1",
      confidence_threshold: 0.85,
    },
    decision_rule: {
      pass_label: "OK",
      fail_label: "NG",
      min_confidence_to_pass: 0.85,
    },
    output_actions: [
      { action_type: "save_result", params: { store_image: false } },
      { action_type: "log_event", params: { log_level: "info" } },
    ],
  },
];

// ---------- Inspection Results ----------
function generateResults() {
  const results = [];
  const now = new Date("2026-07-07T18:00:00Z");
  const defects = ["scratch", "crack", "dent", "porosity", "misalignment", "corrosion"];

  // Deterministic PRNG for hydration consistency
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 100; i++) {
    const tmpl = templates[i % templates.length];
    const hoursAgo = Math.floor(random() * 168);
    const ts = new Date(now.getTime() - hoursAgo * 3600000);
    const confidence = parseFloat((0.45 + random() * 0.54).toFixed(3));
    const threshold = tmpl.decision_rule.min_confidence_to_pass;
    const verdict = confidence >= threshold ? "OK" : "NG";

    // Simulate optional bounding box annotations (60% of results have them)
    const hasAnnotations = random() > 0.4;
    let annotations = null;
    if (hasAnnotations && verdict === "NG") {
      const numBoxes = 1 + Math.floor(random() * 2);
      annotations = [];
      for (let j = 0; j < numBoxes; j++) {
        annotations.push({
          defect_type: defects[Math.floor(random() * defects.length)],
          bbox: [
            Math.floor(30 + random() * 300),
            Math.floor(20 + random() * 200),
            Math.floor(130 + random() * 300),
            Math.floor(120 + random() * 200),
          ],
          confidence: parseFloat((0.5 + random() * 0.49).toFixed(3)),
        });
      }
    }

    results.push({
      id: `insp_${String(i + 1).padStart(4, "0")}`,
      template_id: tmpl.id,
      template_name: tmpl.name,
      model_id: tmpl.inspection_step.model_id,
      confidence,
      threshold,
      verdict,
      annotations,
      timestamp: ts.toISOString(),
      duration_ms: 30 + Math.floor(random() * 200),
    });
  }

  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export const inspectionResults = generateResults();

// ---------- Daily Analytics ----------
export const dailyAnalytics = [
  { date: "Jul 1", total: 82, ok: 65, ng: 17 },
  { date: "Jul 2", total: 95, ok: 78, ng: 17 },
  { date: "Jul 3", total: 78, ok: 60, ng: 18 },
  { date: "Jul 4", total: 104, ok: 87, ng: 17 },
  { date: "Jul 5", total: 91, ok: 73, ng: 18 },
  { date: "Jul 6", total: 110, ok: 92, ng: 18 },
  { date: "Jul 7", total: 88, ok: 70, ng: 18 },
];

// ---------- Alerts ----------
export const alerts = [
  {
    id: "alert_001",
    severity: "critical",
    message: "Defect rate exceeded 30% on Bracket Scratch Inspection template",
    template_name: "Bracket Scratch Inspection",
    defect_rate: 35.2,
    threshold: 30,
    timestamp: "2026-07-07T16:45:00Z",
    acknowledged: false,
  },
  {
    id: "alert_002",
    severity: "warning",
    message: "Model confidence dropping below 70% average on Casting Porosity Check",
    template_name: "Casting Porosity Check",
    defect_rate: 28.5,
    threshold: 25,
    timestamp: "2026-07-07T14:20:00Z",
    acknowledged: false,
  },
  {
    id: "alert_003",
    severity: "critical",
    message: "3 consecutive NG results on Precision Surface QC template",
    template_name: "Precision Surface QC",
    defect_rate: 42.0,
    threshold: 30,
    timestamp: "2026-07-07T11:05:00Z",
    acknowledged: true,
  },
  {
    id: "alert_004",
    severity: "info",
    message: "Model ResNet50-DefectClassifier reloaded after threshold update",
    template_name: null,
    defect_rate: null,
    threshold: null,
    timestamp: "2026-07-07T09:30:00Z",
    acknowledged: true,
  },
  {
    id: "alert_005",
    severity: "warning",
    message: "Weld Seam Inspection template deactivated due to low accuracy",
    template_name: "Weld Seam Inspection",
    defect_rate: null,
    threshold: null,
    timestamp: "2026-07-06T17:00:00Z",
    acknowledged: false,
  },
  {
    id: "alert_006",
    severity: "info",
    message: "New template created: Casting Porosity Check",
    template_name: "Casting Porosity Check",
    defect_rate: null,
    threshold: null,
    timestamp: "2026-07-04T09:30:00Z",
    acknowledged: true,
  },
  {
    id: "alert_007",
    severity: "critical",
    message: "Camera connection timeout — inspection line offline for 5 minutes",
    template_name: null,
    defect_rate: null,
    threshold: null,
    timestamp: "2026-07-06T08:15:00Z",
    acknowledged: true,
  },
];

// ---------- Sample Chat History ----------
export const sampleChatHistory = [
  {
    id: "chat_001",
    role: "user",
    content: "What was today's overall defect rate?",
    timestamp: "2026-07-07T10:00:00Z",
  },
  {
    id: "chat_002",
    role: "assistant",
    content: "Today's overall defect rate is **20.5%** (18 NG out of 88 inspections). The most frequently flagged template is **Precision Surface QC** due to its stricter 90% confidence threshold.",
    timestamp: "2026-07-07T10:00:02Z",
  },
  {
    id: "chat_003",
    role: "user",
    content: "Which template has the highest fail rate?",
    timestamp: "2026-07-07T10:01:00Z",
  },
  {
    id: "chat_004",
    role: "assistant",
    content: "Here are the templates ranked by fail rate:\n\n| Template | Inspections | OK | NG | Fail Rate |\n|----------|------------|----|----|----------|\n| Precision Surface QC | 25 | 16 | 9 | 36.0% |\n| Casting Porosity Check | 25 | 19 | 6 | 24.0% |\n| Bracket Scratch Inspection | 25 | 21 | 4 | 16.0% |\n\n**Precision Surface QC** has the highest fail rate because its confidence threshold is set to 90%, much stricter than the others.",
    timestamp: "2026-07-07T10:01:03Z",
  },
];

// ---------- Helper: compute summary stats ----------
export function getStats() {
  const total = inspectionResults.length;
  const ok = inspectionResults.filter((r) => r.verdict === "OK").length;
  const ng = total - ok;
  const passRate = ((ok / total) * 100).toFixed(1);

  const activeModels = models.filter((m) => m.status === "active").length;
  const activeTemplates = templates.filter((t) => t.is_active).length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;

  return { total, ok, ng, passRate, activeModels, activeTemplates, activeAlerts };
}

// ---------- Helper: get defect breakdown from annotations ----------
export function getDefectBreakdown() {
  const breakdown = {};
  defectTypes.forEach((dt) => {
    breakdown[dt.id] = { count: 0, name: dt.name, color: dt.color };
  });
  inspectionResults.forEach((r) => {
    if (r.annotations) {
      r.annotations.forEach((a) => {
        if (breakdown[a.defect_type]) breakdown[a.defect_type].count++;
      });
    }
  });
  return breakdown;
}

// ---------- Helper: get per-template stats ----------
export function getTemplateStats() {
  return templates.map((tmpl) => {
    const results = inspectionResults.filter((r) => r.template_id === tmpl.id);
    const ok = results.filter((r) => r.verdict === "OK").length;
    return {
      ...tmpl,
      totalInspections: results.length,
      okCount: ok,
      ngCount: results.length - ok,
      passRate: results.length > 0 ? parseFloat(((ok / results.length) * 100).toFixed(1)) : 0,
    };
  });
}
