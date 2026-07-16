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
export async function fetchResults(page = 1, limit = 20, verdict = null) {
  let url = `/api/results?page=${page}&limit=${limit}`;
  if (verdict) url += `&verdict=${verdict}`;
  return apiGet(url);
}

export function getResultsExportUrl(verdict = null) {
  let url = `${BASE_URL}/api/results/export`;
  if (verdict) url += `?verdict=${verdict}`;
  return url;
}

// ─── Alerts ───────────────────────────────────────
export async function fetchAlerts() {
  return apiGet('/api/alerts/');
}

// ─── Chatbot ──────────────────────────────────────
export async function sendChatMessage(message) {
  return apiPost('/api/chat/', { message });
}
