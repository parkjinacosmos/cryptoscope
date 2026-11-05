const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type Algorithm = 'DES' | 'AES' | 'RSA';
export type InputType = 'text' | 'file';

export interface Experiment {
  id: number;
  algorithm: Algorithm;
  input_size: number;
  input_type: InputType;
  repeat_count: number;
  encrypt_ms: number;
  decrypt_ms: number;
  encrypt_median_ms: number;
  decrypt_median_ms: number;
  encrypt_measurements: number[];
  decrypt_measurements: number[];
  created_at: string;
}

export interface Summary {
  algorithm: Algorithm;
  experiment_count: number;
  average_input_size: number;
  average_encrypt_ms: number;
  average_decrypt_ms: number;
}

export interface EstimateResult {
  top_algorithm: Algorithm;
  top_similarity: number;
  input_size: number;
  input_type: InputType;
  results: Array<{
    algorithm: Algorithm;
    score: number;
    similarity: number;
    reference_count: number;
    reference_size_count: number;
    expected_encrypt_ms: number;
    expected_decrypt_ms: number;
  }>;
  notice: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === 'string' ? detail : detail?.message;
    throw new Error(message || `요청에 실패했습니다. (${response.status})`);
  }
  return payload as T;
}

export function runTextExperiment(
  algorithm: Algorithm,
  text: string,
  repeatCount: number,
): Promise<Experiment> {
  return request<Experiment>('/api/experiments/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm, text, repeat_count: repeatCount }),
  });
}

export function runFileExperiment(file: File, repeatCount: number): Promise<Experiment> {
  const form = new FormData();
  form.append('file', file);
  return request<Experiment>(`/api/experiments/run/file?repeat_count=${repeatCount}`, {
    method: 'POST',
    body: form,
  });
}

export async function getHistory(): Promise<Experiment[]> {
  const result = await request<{ items: Experiment[] }>('/api/experiments/history?limit=200');
  return result.items;
}

export async function getSummary(): Promise<Summary[]> {
  const result = await request<{ items: Summary[] }>('/api/experiments/summary');
  return result.items;
}

export function estimateAlgorithm(values: {
  input_size: number;
  encrypt_ms: number;
  decrypt_ms: number;
  input_type: InputType;
}): Promise<EstimateResult> {
  return request<EstimateResult>('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    await request('/api/health');
    return true;
  } catch {
    return false;
  }
}
