package chunker

import "strings"

// FixedSizeChunker splits text into chunks of exactly ChunkSize runes with
// ChunkOverlap runes of shared context between consecutive chunks.
type FixedSizeChunker struct {
	cfg FixedSizeConfig
}

func NewFixedSizeChunker(cfg FixedSizeConfig) *FixedSizeChunker {
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 512
	}
	if cfg.ChunkOverlap < 0 || cfg.ChunkOverlap >= cfg.ChunkSize {
		cfg.ChunkOverlap = cfg.ChunkSize / 10
	}
	return &FixedSizeChunker{cfg: cfg}
}

func (c *FixedSizeChunker) Chunk(text string) ([]Chunk, error) {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) == 0 {
		return nil, nil
	}

	step := c.cfg.ChunkSize - c.cfg.ChunkOverlap
	if step <= 0 {
		step = 1
	}

	var chunks []Chunk
	idx := 0
	for start := 0; start < len(runes); start += step {
		end := start + c.cfg.ChunkSize
		if end > len(runes) {
			end = len(runes)
		}
		content := strings.TrimSpace(string(runes[start:end]))
		if content != "" {
			chunks = append(chunks, Chunk{Index: idx, Content: content})
			idx++
		}
		if end == len(runes) {
			break
		}
	}
	return chunks, nil
}
