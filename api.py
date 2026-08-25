import os
import sys
import time
import json
import base64
from pathlib import Path
from typing import List, Optional, Dict, Any


from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from src.config import settings
from src.rag_engine import rag_engine
from src.parser import DocumentParser
from src.chunker import chunker
from src.vector_store import vector_store
from src.evaluation import RAGEvaluator

# Initialize FastAPI App
app = FastAPI(
    title="Enterprise Applied RAG Backend",
    description="Decoupled High-Performance RAG Backend for Render deployment with Cohere Reranking and Mistral AI",
    version="2.0.0"
)

# Enable CORS for Vercel Frontend and Local Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- PYDANTIC SCHEMAS ----------------

class QueryRequest(BaseModel):
    query: str = Field(..., description="The user query text")
    top_k: Optional[int] = Field(default=15, description="Number of hybrid candidates to retrieve")
    rerank_top_n: Optional[int] = Field(default=5, description="Number of top documents after reranking")

class SourceItem(BaseModel):
    source: Optional[str] = None
    doc_type: Optional[str] = None
    page: Optional[int] = None
    section_id: Optional[Any] = None
    channel: Optional[str] = None
    image_name: Optional[str] = None
    image_base64: Optional[str] = None
    chunk_id: Optional[str] = None
    rerank_score: Optional[float] = None
    hybrid_score: Optional[float] = None
    text_preview: Optional[str] = None
    full_text: Optional[str] = None

class TelemetryData(BaseModel):
    total_latency: float
    retrieval_latency: float
    rerank_latency: float
    llm_latency: float
    tokens: int
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0
    model: str

class QueryResponse(BaseModel):
    answer: str
    is_error: bool
    error_detail: Optional[str] = None
    sources: List[SourceItem]
    telemetry: TelemetryData

class BenchmarkRequest(BaseModel):
    dataset_name: Optional[str] = Field(default="golden_dataset.json", description="Name of dataset to benchmark against")


# ---------------- ENDPOINTS ----------------

@app.get("/")
def root():
    return {
        "name": "Enterprise Applied RAG Backend API",
        "status": "healthy",
        "docs": "/docs",
        "version": "2.0.0",
        "hosting": "Render Ready"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "qdrant": "connected" if settings.QDRANT_URL else "local_embedded"
    }

@app.get("/api/system-info")
def get_system_info():
    llm_name = f"Mistral AI ({settings.MISTRAL_MODEL})" if settings.MISTRAL_API_KEY else f"OpenRouter ({settings.OPENROUTER_MODEL})"
    rerank_name = f"Cohere Rerank ({settings.COHERE_RERANK_MODEL})" if settings.COHERE_API_KEY else "FlashRank (Local ONNX)"
    return {
        "embedding_model": settings.GEMINI_EMBEDDING_MODEL,
        "embedding_dim": settings.EMBEDDING_DIM,
        "llm_generator": llm_name,
        "llm_model_id": settings.MISTRAL_MODEL if settings.MISTRAL_API_KEY else settings.OPENROUTER_MODEL,
        "reranker": rerank_name,
        "rerank_model_id": settings.COHERE_RERANK_MODEL if settings.COHERE_API_KEY else "ms-marco-TinyBERT-L-2-v2",
        "vector_db": "Qdrant Cloud (AWS)" if settings.QDRANT_URL else "Embedded Qdrant (Local)",
        "sparse_index": "BM25 Okapi Hybrid Fusion (RRF)",
        "phoenix_port": settings.PHOENIX_PORT
    }

@app.post("/api/query", response_model=QueryResponse)
def execute_query(req: QueryRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    result = rag_engine.query(req.query.strip())
    
    telemetry = {
        "total_latency": result["total_latency_seconds"],
        "retrieval_latency": result["retrieval_metadata"]["retrieval_latency"],
        "rerank_latency": result["retrieval_metadata"]["rerank_latency"],
        "llm_latency": result["generation_metadata"]["latency_seconds"],
        "tokens": result["generation_metadata"]["total_tokens"],
        "prompt_tokens": result["generation_metadata"].get("prompt_tokens", 0),
        "completion_tokens": result["generation_metadata"].get("completion_tokens", 0),
        "model": result["generation_metadata"].get("model", settings.MISTRAL_MODEL)
    }
    
    return {
        "answer": result["answer"],
        "is_error": result.get("is_error", False),
        "error_detail": result.get("error_detail"),
        "sources": result.get("sources", []),
        "telemetry": telemetry
    }

@app.get("/api/documents")
def list_documents():
    data_dir = settings.DATA_DIR
    if not data_dir.exists():
        data_dir.mkdir(parents=True, exist_ok=True)
        
    doc_files = list(data_dir.glob("*.*"))
    docs = []
    for df in doc_files:
        docs.append({
            "name": df.name,
            "size_kb": round(df.stat().st_size / 1024, 2),
            "extension": df.suffix.lower().replace(".", ""),
            "last_modified": time.ctime(df.stat().st_mtime),
            "timestamp": df.stat().st_mtime
        })
    docs.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"documents": docs, "total": len(docs)}

@app.post("/api/documents/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    saved_files = []
    data_dir = settings.DATA_DIR
    data_dir.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        target_path = data_dir / file.filename
        content = await file.read()
        with open(target_path, "wb") as f:
            f.write(content)
        saved_files.append(file.filename)
        
    # Re-index
    raw_docs = DocumentParser.parse_directory(data_dir)
    chunks = chunker.chunk_documents(raw_docs)
    vector_store.clear()
    count = vector_store.add_documents(chunks)
    
    return {
        "message": f"Successfully uploaded {len(saved_files)} files and indexed {count} chunks into Qdrant.",
        "saved_files": saved_files,
        "indexed_chunks": count
    }

@app.post("/api/documents/reindex")
def reindex_all():
    data_dir = settings.DATA_DIR
    raw_docs = DocumentParser.parse_directory(data_dir)
    chunks = chunker.chunk_documents(raw_docs)
    vector_store.clear()
    count = vector_store.add_documents(chunks)
    return {"message": f"Re-indexed {count} chunks into Qdrant Vector Store successfully.", "indexed_chunks": count}

@app.get("/api/evaluation/datasets")
def list_eval_datasets():
    datasets = []
    for d_name in ["golden_dataset.json", "synthetic_golden_qa.json"]:
        p = settings.BASE_DIR / d_name
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            datasets.append({
                "filename": d_name,
                "count": len(data) if isinstance(data, list) else 0
            })
    return {"datasets": datasets}

@app.post("/api/evaluation/run")
def run_evaluation(req: BenchmarkRequest):
    dataset_name = req.dataset_name or "golden_dataset.json"
    dataset_path = settings.BASE_DIR / dataset_name
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found.")
        
    evaluator = RAGEvaluator(str(dataset_path))
    results = evaluator.run_benchmark()
    return results

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
