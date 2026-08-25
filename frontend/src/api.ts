import type { QueryResponse, DocumentItem, SystemInfo, BenchmarkSummary } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchHealth(): Promise<{ status: string; qdrant: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  const res = await fetch(`${API_BASE}/api/system-info`);
  if (!res.ok) throw new Error('Failed to load system info');
  return res.json();
}

export async function queryRAG(queryText: string): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Query failed' }));
    throw new Error(err.detail || 'Query request failed');
  }
  return res.json();
}

export async function fetchDocuments(): Promise<{ documents: DocumentItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error('Failed to load documents');
  return res.json();
}

export async function uploadDocuments(files: FileList | File[]): Promise<{ message: string; indexed_chunks: number }> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Document upload failed');
  }
  return res.json();
}

export async function reindexDocuments(): Promise<{ message: string; indexed_chunks: number }> {
  const res = await fetch(`${API_BASE}/api/documents/reindex`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to re-index documents');
  return res.json();
}

export async function fetchDatasets(): Promise<{ datasets: { filename: string; count: number }[] }> {
  const res = await fetch(`${API_BASE}/api/evaluation/datasets`);
  if (!res.ok) throw new Error('Failed to load evaluation datasets');
  return res.json();
}

export async function runBenchmark(datasetName: string): Promise<BenchmarkSummary> {
  const res = await fetch(`${API_BASE}/api/evaluation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: datasetName })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Benchmark failed' }));
    throw new Error(err.detail || 'Failed to run benchmark');
  }
  return res.json();
}
