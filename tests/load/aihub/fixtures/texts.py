EMBED_INPUTS: list[list[str]] = [
    # Short single sentences
    ["The quick brown fox jumps over the lazy dog."],
    ["Machine learning is a subset of artificial intelligence."],
    ["Python is a high-level, general-purpose programming language."],
    # Multi-sentence paragraphs
    [
        "Natural language processing enables computers to understand human language. "
        "It combines linguistics, computer science, and machine learning."
    ],
    [
        "Vector databases store high-dimensional embeddings for semantic search. "
        "They are commonly used in retrieval-augmented generation pipelines."
    ],
    # Batch of short texts (common production scenario)
    [
        "What is the capital of France?",
        "How does photosynthesis work?",
        "Explain the concept of recursion.",
    ],
    [
        "Large language models are trained on massive text corpora.",
        "Transformers use self-attention mechanisms to process sequences.",
        "Fine-tuning adapts a pre-trained model to a specific downstream task.",
        "Retrieval-augmented generation combines LLMs with external knowledge bases.",
    ],
    # Longer technical document chunk
    [
        "The attention mechanism in transformer architectures allows the model to "
        "weigh the importance of different tokens when encoding a sequence. "
        "Multi-head attention runs the attention function in parallel across several "
        "learned projection spaces, capturing both local and global dependencies. "
        "Positional encodings are added to token embeddings to preserve sequence order "
        "information, since the self-attention operation itself is permutation-invariant."
    ],
    # Code-like content
    [
        "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)"
    ],
    [
        "SELECT u.id, u.name, COUNT(o.id) AS order_count "
        "FROM users u LEFT JOIN orders o ON u.id = o.user_id "
        "GROUP BY u.id, u.name ORDER BY order_count DESC;"
    ],
]

RERANK_QUERIES: list[str] = [
    "What are the benefits of vector search?",
    "How do transformer models work?",
    "Best practices for API security",
    "Explain gradient descent optimization",
    "What is retrieval-augmented generation?",
    "How to improve model inference performance?",
    "What is the difference between SQL and NoSQL databases?",
]

RERANK_DOCUMENT_SETS: list[list[str]] = [
    # General AI / ML documents
    [
        "Vector search uses embeddings to find semantically similar items quickly.",
        "Traditional keyword search relies on exact term matching.",
        "Approximate nearest neighbor algorithms enable scalable vector retrieval.",
        "Dense retrieval outperforms sparse retrieval on many NLP benchmarks.",
        "Vector databases like Pinecone and Qdrant are purpose-built for embeddings.",
        "BM25 is a popular sparse retrieval algorithm based on TF-IDF.",
        "Hybrid search combines dense and sparse retrieval for better coverage.",
    ],
    [
        "The transformer architecture was introduced in the 'Attention Is All You Need' paper.",
        "Self-attention allows each token to attend to all other tokens in the sequence.",
        "BERT uses bidirectional transformers for language understanding tasks.",
        "GPT models are autoregressive transformers trained for text generation.",
        "Positional encodings inject sequence order information into token embeddings.",
        "Layer normalization stabilizes training in deep transformer networks.",
        "Feed-forward layers in transformers apply non-linear transformations per token.",
    ],
    [
        "Always validate and sanitize user inputs to prevent injection attacks.",
        "Use HTTPS and TLS to encrypt data in transit.",
        "Implement rate limiting to prevent abuse of public API endpoints.",
        "OAuth 2.0 is the industry standard for API authorization.",
        "Never expose internal error stack traces in API responses.",
        "API keys should be rotated regularly and stored in secure vaults.",
        "CORS policies should be configured to allow only trusted origins.",
    ],
    [
        "Gradient descent iteratively updates model parameters in the direction of steepest loss reduction.",
        "The learning rate controls how large each parameter update step is.",
        "Adam optimizer combines momentum and adaptive learning rates.",
        "Batch gradient descent computes gradients over the entire dataset.",
        "Stochastic gradient descent updates parameters using a single sample at a time.",
        "Mini-batch SGD is a compromise between full-batch and stochastic approaches.",
        "Learning rate schedulers reduce the learning rate over training for finer convergence.",
    ],
    [
        "RAG augments LLM generation with retrieved external knowledge.",
        "A retriever fetches relevant document chunks based on a query embedding.",
        "The retrieved context is appended to the prompt before generation.",
        "RAG reduces hallucinations by grounding answers in factual documents.",
        "Chunking strategy affects retrieval quality in RAG pipelines.",
        "Reranking retrieved chunks improves the signal passed to the generator.",
        "Hybrid RAG combines dense and sparse retrieval for better recall.",
    ],
]
