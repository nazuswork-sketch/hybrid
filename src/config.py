import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / '.env', override=True)

def get_secret(key: str, default: str = "") -> str:
    """Retrieve configuration secrets prioritizing os.environ and .env."""
    return os.getenv(key, default)

class Settings:
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = BASE_DIR / 'data'
    STORAGE_DIR: Path = BASE_DIR / 'storage'
    
    @property
    def GEMINI_API_KEY(self) -> str:
        return get_secret('GEMINI_API_KEY', '')
        
    @property
    def GEMINI_EMBEDDING_MODEL(self) -> str:
        return get_secret('GEMINI_EMBEDDING_MODEL', 'models/gemini-embedding-2')
        
    EMBEDDING_DIM: int = 3072
    
    # Mistral AI API Configuration (LLM Generator)
    @property
    def MISTRAL_API_KEY(self) -> str:
        return get_secret('MISTRAL_API_KEY', '')

    @property
    def MISTRAL_MODEL(self) -> str:
        return get_secret('MISTRAL_MODEL', 'mistral-medium-2508')

    @property
    def MISTRAL_BASE_URL(self) -> str:
        return get_secret('MISTRAL_BASE_URL', 'https://api.mistral.ai/v1')

    # Cohere API Configuration (Cross-Encoder Reranker)
    @property
    def COHERE_API_KEY(self) -> str:
        return get_secret('COHERE_API_KEY', '')

    @property
    def COHERE_RERANK_MODEL(self) -> str:
        return get_secret('COHERE_RERANK_MODEL', 'rerank-v3.5')

    # OpenRouter API Configuration (Legacy / Fallback)
    @property
    def OPENROUTER_API_KEY(self) -> str:
        return get_secret('OPENROUTER_API_KEY', '')
        
    @property
    def OPENROUTER_MODEL(self) -> str:
        return get_secret('OPENROUTER_MODEL', 'nvidia/nemotron-3.5-lightning:free')
        
    @property
    def OPENROUTER_BASE_URL(self) -> str:
        return get_secret('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
    
    # Qdrant Vector DB (Cloud or Local Embedded)
    @property
    def QDRANT_URL(self) -> str:
        return get_secret('QDRANT_URL', '')
        
    @property
    def QDRANT_API_KEY(self) -> str:
        return get_secret('QDRANT_API_KEY', '')
        
    @property
    def QDRANT_STORAGE_PATH(self) -> str:
        return get_secret('QDRANT_STORAGE_PATH', str(self.STORAGE_DIR / 'qdrant_db'))
        
    @property
    def QDRANT_COLLECTION_NAME(self) -> str:
        return get_secret('QDRANT_COLLECTION_NAME', 'enterprise_knowledge_base')
    
    # RAG Retrieval Configuration
    RETRIEVAL_TOP_K: int = 15     # Number of candidates from hybrid search
    RERANK_TOP_N: int = 5         # Number of candidates sent to LLM after reranker
    CHUNK_SIZE: int = 1500        # Optimized semantic chunk size for high-precision fact lookup
    CHUNK_OVERLAP: int = 200
    MAX_GENERATION_TOKENS: int = 4096  # Max output tokens to prevent answer truncation
    
    # Observability
    PHOENIX_PORT: int = 6006

settings = Settings()
