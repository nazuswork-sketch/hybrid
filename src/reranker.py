import json
import urllib.request
import urllib.error
from typing import List, Dict, Any
from src.config import settings

class LocalFlashRanker:
    """Ultra-fast, zero-Docker, local cross-encoder reranker fallback."""

    def __init__(self, model_name: str = "ms-marco-TinyBERT-L-2-v2"):
        self.model_name = model_name
        self._ranker = None

    @property
    def ranker(self):
        if self._ranker is None:
            try:
                from flashrank import Ranker
                self._ranker = Ranker(model_name=self.model_name, cache_dir=str(settings.STORAGE_DIR / "flashrank_cache"))
            except Exception as e:
                print(f"[FlashRank Init Note] {e}")
        return self._ranker

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_n: int = settings.RERANK_TOP_N) -> List[Dict[str, Any]]:
        if not documents:
            return []
            
        passages = [
            {"id": i, "text": doc.get("text", ""), "meta": doc}
            for i, doc in enumerate(documents)
        ]
        
        try:
            if self.ranker:
                from flashrank import RerankRequest
                rerank_request = RerankRequest(query=query, passages=passages)
                results = self.ranker.rerank(rerank_request)
                
                reranked_docs = []
                for item in results[:top_n]:
                    meta = dict(item.get("meta", {}))
                    meta["rerank_score"] = round(float(item.get("score", 0.0)), 4)
                    reranked_docs.append(meta)
                if reranked_docs:
                    return reranked_docs
        except Exception as e:
            print(f"[FlashRank Warning] {e}")
            
        return documents[:top_n]


class CohereReranker:
    """Enterprise Cross-Encoder Reranker powered by Cohere Rerank API (v3.5)."""

    def __init__(self, api_key: str = None, model: str = None):
        self._api_key = api_key
        self._model = model
        self._fallback_ranker = LocalFlashRanker()

    @property
    def api_key(self) -> str:
        return self._api_key or settings.COHERE_API_KEY

    @property
    def model(self) -> str:
        return self._model or settings.COHERE_RERANK_MODEL

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_n: int = settings.RERANK_TOP_N) -> List[Dict[str, Any]]:
        if not documents:
            return []

        key = self.api_key
        if not key:
            return self._fallback_ranker.rerank(query, documents, top_n)

        # Prepare document texts
        doc_texts = [d.get("text", "").strip() or " " for d in documents]

        # 1. Try Cohere SDK ClientV2
        try:
            import cohere
            co = cohere.ClientV2(api_key=key)
            response = co.rerank(
                model=self.model,
                query=query,
                documents=doc_texts,
                top_n=min(top_n, len(documents))
            )
            if hasattr(response, "results") and response.results:
                reranked_docs = []
                for item in response.results:
                    idx = item.index
                    score = item.relevance_score
                    if idx < len(documents):
                        meta = dict(documents[idx])
                        meta["rerank_score"] = round(float(score), 4)
                        reranked_docs.append(meta)
                if reranked_docs:
                    return reranked_docs
        except Exception as sdk_err:
            # 2. Fallback to direct HTTP Request against Cohere v2 rerank endpoint
            try:
                url = "https://api.cohere.com/v2/rerank"
                payload = {
                    "model": self.model,
                    "query": query,
                    "documents": doc_texts,
                    "top_n": min(top_n, len(documents))
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "X-Client-Name": "Enterprise-RAG"
                    }
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    results = data.get("results", [])
                    reranked_docs = []
                    for item in results:
                        idx = item.get("index")
                        score = item.get("relevance_score", 0.0)
                        if idx is not None and idx < len(documents):
                            meta = dict(documents[idx])
                            meta["rerank_score"] = round(float(score), 4)
                            reranked_docs.append(meta)
                    if reranked_docs:
                        return reranked_docs
            except Exception as http_err:
                print(f"[Cohere Rerank Warning] API error: {http_err}. Falling back to local FlashRank.")
                return self._fallback_ranker.rerank(query, documents, top_n)

        return self._fallback_ranker.rerank(query, documents, top_n)

reranker = CohereReranker()
