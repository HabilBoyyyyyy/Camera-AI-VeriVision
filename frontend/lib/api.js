const BASE_URL = "http://localhost:8000";

async function apiGet(path, redirectOn401 = true) {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
  if (res.status === 401) {
    if (redirectOn401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Delete failed' }));
    throw new Error(err.detail || 'Delete failed');
  }
  return res.json();
}

async function apiPut(path, body = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ─── Auth ──────────────────────────────────────────
export async function login(username, password) {
  return apiPost('/api/auth/login', { username, password });
}

export async function registerUser(username, password, role = "inspector") {
  return apiPost('/api/auth/register', { username, password, role });
}

export async function logout() {
  return apiPost('/api/auth/logout', {});
}

export async function getMe() {
  try {
    return await apiGet('/api/auth/me', false);
  } catch {
    return null;
  }
}

// ─── Dashboard ────────────────────────────────────
export async function fetchDashboardSummary() {
  return apiGet('/api/dashboard/summary');
}

// ─── Datasets ─────────────────────────────────────
export async function fetchDatasets() {
  return apiGet('/api/datasets');
}

export async function fetchDataset(id) {
  return apiGet(`/api/datasets/${id}`);
}

export async function fetchDatasetImages(id) {
  return apiGet(`/api/datasets/${id}/images`);
}

export async function uploadDataset(formData) {
  const res = await fetch(`${BASE_URL}/api/datasets/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,  // FormData with 'file' and 'task_type'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(JSON.stringify(err.detail || err));
  }
  return res.json();
}

export async function deleteDataset(id) {
  return apiDelete(`/api/datasets/${id}`);
}

export async function createDataset(name, taskType) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("task_type", taskType);
  const res = await fetch(`${BASE_URL}/api/datasets/create`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Create failed' }));
    throw new Error(err.detail || 'Create failed');
  }
  return res.json();
}


export async function deleteDatasetImage(datasetId, filename) {
  return apiDelete(`/api/datasets/${datasetId}/images/${encodeURIComponent(filename)}`);
}

export async function addImagesToDataset(datasetId, formData) {
  const res = await fetch(`${BASE_URL}/api/datasets/${datasetId}/add-images`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Add images failed' }));
    throw new Error(err.detail || 'Add images failed');
  }
  return res.json();
}

// ─── Training ─────────────────────────────────────
export async function startTraining(config) {
  return apiPost('/api/training/start', config);
}

export async function getTrainingStatus(jobId) {
  return apiGet(`/api/training/status/${jobId}`);
}

export async function getTrainingHistory() {
  return apiGet('/api/training/history');
}

// ─── Models ───────────────────────────────────────
export async function fetchModels() {
  return apiGet('/api/models');
}

export async function fetchModel(id) {
  return apiGet(`/api/models/${id}`);
}

export async function fetchModelVisualizations(id) {
  return apiGet(`/api/models/${id}/visualizations`);
}

export async function deleteModel(id) {
  return apiDelete(`/api/models/${id}?confirm=true`);
}

export function getModelDownloadUrl(id) {
  return `${BASE_URL}/api/models/${id}/download`;
}

// ─── Inspection ───────────────────────────────────
export async function runInspection(formData) {
  const res = await fetch(`${BASE_URL}/api/inspection/inspect`, {
    method: 'POST',
    credentials: 'include',
    body: formData,  // FormData: file, model_id, threshold
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Inspection failed' }));
    throw new Error(err.detail || 'Inspection failed');
  }
  return res.json();
}

export async function fetchInspectionModels() {
  return apiGet('/api/inspection/models');
}

// ─── Results ──────────────────────────────────────
export async function fetchResults(page = 1, limit = 20, filters = {}) {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  
  if (filters.verdict) params.append("verdict", filters.verdict);
  if (filters.model_id) params.append("model_id", filters.model_id);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.min_conf !== undefined && filters.min_conf !== "") params.append("min_conf", filters.min_conf);
  if (filters.max_conf !== undefined && filters.max_conf !== "") params.append("max_conf", filters.max_conf);
  if (filters.search_id) params.append("search_id", filters.search_id);
  if (filters.review_status) params.append("review_status", filters.review_status);

  return apiGet(`/api/results?${params.toString()}`);
}

export function getResultsExportUrl(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.verdict) params.append("verdict", filters.verdict);
  if (filters.model_id) params.append("model_id", filters.model_id);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.min_conf !== undefined && filters.min_conf !== "") params.append("min_conf", filters.min_conf);
  if (filters.max_conf !== undefined && filters.max_conf !== "") params.append("max_conf", filters.max_conf);
  if (filters.search_id) params.append("search_id", filters.search_id);
  if (filters.review_status) params.append("review_status", filters.review_status);

  return `${BASE_URL}/api/results/export${params.toString() ? '?' + params.toString() : ''}`;
}

export async function deleteResult(id) {
  return apiDelete(`/api/results/${id}`);
}

export async function submitReview(resultId, reviewVerdict, reviewNotes = "") {
  return apiPut(`/api/results/${resultId}/review`, {
    review_verdict: reviewVerdict,
    review_notes: reviewNotes,
  });
}

export async function undoReview(resultId) {
  return apiPost(`/api/results/${resultId}/undo-review`, {});
}

export async function fetchFeedbackStats() {
  return apiGet('/api/results/feedback-stats');
}

// ─── Alerts ───────────────────────────────────────
export async function fetchAlerts() {
  return apiGet('/api/alerts/');
}

// ─── Chatbot ──────────────────────────────────────
export async function sendChatMessage(message) {
  return apiPost('/api/chat/', { message });
}

// ─── Annotations (localStorage fallback) ──────────
const ANNOT_KEY = "vv-annotations";

function _getAnnotStore() {
  try { return JSON.parse(localStorage.getItem(ANNOT_KEY) || "{}"); }
  catch { return {}; }
}

export async function saveAnnotations(datasetId, filename, annotations) {
  const store = _getAnnotStore();
  const key = `${datasetId}::${filename}`;
  store[key] = { annotations, updatedAt: new Date().toISOString() };
  localStorage.setItem(ANNOT_KEY, JSON.stringify(store));
  return { status: "saved", count: annotations.length };
}

export async function fetchAnnotations(datasetId, filename) {
  const store = _getAnnotStore();
  const key = `${datasetId}::${filename}`;
  return store[key]?.annotations || [];
}

export function hasAnnotations(datasetId, filename) {
  const store = _getAnnotStore();
  const key = `${datasetId}::${filename}`;
  return (store[key]?.annotations?.length || 0) > 0;
}

export function exportAnnotationsYOLO(annotations, imgWidth, imgHeight, classNames) {
  return annotations.map(a => {
    const clsIdx = classNames.indexOf(a.label);
    if (a.type === "box") {
      const cx = (a.x + a.w / 2) / imgWidth;
      const cy = (a.y + a.h / 2) / imgHeight;
      const nw = a.w / imgWidth;
      const nh = a.h / imgHeight;
      return `${clsIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`;
    }
    // polygon → bounding box fallback for YOLO
    if (a.type === "polygon" && a.points?.length >= 3) {
      const xs = a.points.map(p => p.x);
      const ys = a.points.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2 / imgWidth;
      const cy = (minY + maxY) / 2 / imgHeight;
      const nw = (maxX - minX) / imgWidth;
      const nh = (maxY - minY) / imgHeight;
      return `${clsIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`;
    }
    return null;
  }).filter(Boolean).join("\n");
}
