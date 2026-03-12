#!/usr/bin/env python3
"""Download embedding and rerank models into services/aihub/.models/

Usage:
    # From the repo root (uv workspace):
    uv run --directory services/aihub python scripts/download_models.py --rerank

    # Or directly with python (if sentence-transformers is installed):
    python services/aihub/scripts/download_models.py

    # Download only embedding models:
    python scripts/download_models.py --embedding

    # Download only rerank models:
    python scripts/download_models.py --rerank
"""

import argparse
import sys
from pathlib import Path

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("ERROR: huggingface_hub not found. Install sentence-transformers first.", file=sys.stderr)
    sys.exit(1)

MODELS_DIR = Path(__file__).parent.parent / ".models"

# 3 embedding models already present in .models/
EMBEDDING_MODELS: list[tuple[str, str]] = [
    ("sentence-transformers/all-MiniLM-L6-v2", "all-MiniLM-L6-v2"),
    ("BAAI/bge-m3",                             "bge-m3"),
    ("intfloat/multilingual-e5-base",           "multilingual-e5-base"),
]

# Rerank models (CrossEncoder-compatible)
RERANK_MODELS: list[tuple[str, str]] = [
    ("BAAI/bge-reranker-v2-m3",               "bge-reranker-v2-m3"),
    ("BAAI/bge-reranker-base",                "bge-reranker-base"),
]

# Files not needed for inference — skip to save disk space
_IGNORE = [
    "*.msgpack",
    "flax_model*",
    "tf_model*",
    "rust_model*",
    "onnx/*",
]


def _is_downloaded(path: Path) -> bool:
    """Return True if the folder exists and contains at least one model file."""
    if not path.is_dir():
        return False
    return any(path.glob("*.safetensors")) or any(path.glob("*.bin"))


def download_model(repo_id: str, local_name: str) -> None:
    local_dir = MODELS_DIR / local_name
    if _is_downloaded(local_dir):
        print(f"  [skip]     {repo_id:50s}  (already at .models/{local_name})")
        return
    print(f"  [download] {repo_id:50s}  → .models/{local_name}")
    snapshot_download(
        repo_id=repo_id,
        local_dir=str(local_dir),
        ignore_patterns=_IGNORE,
    )
    print(f"  [done]     {repo_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download models into .models/")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--embedding", action="store_true", help="Download only embedding models")
    group.add_argument("--rerank",    action="store_true", help="Download only rerank models")
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    run_embedding = not args.rerank
    run_rerank    = not args.embedding

    if run_embedding:
        print("=== Embedding models ===")
        for repo_id, name in EMBEDDING_MODELS:
            download_model(repo_id, name)

    if run_rerank:
        print("\n=== Rerank models ===")
        for repo_id, name in RERANK_MODELS:
            download_model(repo_id, name)

    print("\nAll done.")


if __name__ == "__main__":
    main()
