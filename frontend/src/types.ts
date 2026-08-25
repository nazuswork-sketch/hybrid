export interface SourceItem {
  source?: string;
  doc_type?: string;
  page?: number;
  section_id?: string | number;
  channel?: string;
  image_name?: string;
  image_base64?: string;
  chunk_id?: string;
  rerank_score?: number;
  hybrid_score?: number;
  text_preview?: string;
  full_text?: string;
}

export interface TelemetryData {
  total_latency: number;
  retrieval_latency: number;
  rerank_latency: number;
  llm_latency: number;
  tokens: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  model: string;
}

export interface QueryResponse {
  answer: string;
  is_error: boolean;
  error_detail?: string;
  sources: SourceItem[];
  telemetry: TelemetryData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  telemetry?: TelemetryData;
  isError?: boolean;
  timestamp: string;
}

export interface DocumentItem {
  name: string;
  size_kb: number;
  extension: string;
  last_modified: string;
  timestamp: number;
}

export interface SystemInfo {
  embedding_model: string;
  embedding_dim: number;
  llm_generator: string;
  llm_model_id: string;
  reranker: string;
  rerank_model_id: string;
  vector_db: string;
  sparse_index: string;
  phoenix_port: number;
}

export interface BenchmarkDetailItem {
  question: string;
  ground_truth: string;
  generated_answer: string;
  faithfulness: number;
  context_precision: number;
  context_recall: number;
  answer_relevancy: number;
  reasoning: string;
  eval_status: string;
  latency_seconds: number;
  sources_count: number;
}

export interface BenchmarkSummary {
  total_questions: number;
  valid_evaluations: number;
  failed_evaluations: number;
  avg_faithfulness: number;
  avg_context_precision: number;
  avg_context_recall: number;
  avg_answer_relevancy: number;
  avg_latency_seconds: number;
  detailed_results: BenchmarkDetailItem[];
}
