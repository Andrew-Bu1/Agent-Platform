package chunker

import (
	"encoding/json"
	"fmt"
)

// Chunk is a single text segment produced by any chunking strategy.
type Chunk struct {
	Index   int
	Content string
}

// Chunker is the interface all strategies implement.
type Chunker interface {
	Chunk(text string) ([]Chunk, error)
}

// FixedSizeConfig holds parameters for fixed-size chunking.
type FixedSizeConfig struct {
	ChunkSize    int `json:"chunk_size"`
	ChunkOverlap int `json:"chunk_overlap"`
}

// RecursiveSplitConfig holds parameters for recursive splitting.
type RecursiveSplitConfig struct {
	ChunkSize    int      `json:"chunk_size"`
	ChunkOverlap int      `json:"chunk_overlap"`
	Separators   []string `json:"separators"`
}

// SemanticChunkingConfig holds parameters for semantic chunking.
type SemanticChunkingConfig struct {
	MaxChunkSize        int     `json:"max_chunk_size"`
	SimilarityThreshold float64 `json:"similarity_threshold"`
}

// New returns the appropriate Chunker for strategy + raw JSON config.
func New(strategy string, rawConfig json.RawMessage) (Chunker, error) {
	switch strategy {
	case "fixed_size":
		cfg := FixedSizeConfig{ChunkSize: 512, ChunkOverlap: 50}
		if len(rawConfig) > 0 {
			if err := json.Unmarshal(rawConfig, &cfg); err != nil {
				return nil, fmt.Errorf("fixed_size config: %w", err)
			}
		}
		return NewFixedSizeChunker(cfg), nil

	case "recursive_split":
		cfg := RecursiveSplitConfig{
			ChunkSize:    512,
			ChunkOverlap: 50,
			Separators:   []string{"\n\n", "\n", ". ", " ", ""},
		}
		if len(rawConfig) > 0 {
			if err := json.Unmarshal(rawConfig, &cfg); err != nil {
				return nil, fmt.Errorf("recursive_split config: %w", err)
			}
		}
		return NewRecursiveSplitChunker(cfg), nil

	case "semantic_chunking":
		cfg := SemanticChunkingConfig{MaxChunkSize: 1024, SimilarityThreshold: 0.4}
		if len(rawConfig) > 0 {
			if err := json.Unmarshal(rawConfig, &cfg); err != nil {
				return nil, fmt.Errorf("semantic_chunking config: %w", err)
			}
		}
		return NewSemanticChunker(cfg), nil

	default:
		return nil, fmt.Errorf("unknown chunk strategy: %q", strategy)
	}
}
