package chunker

import "strings"

// RecursiveSplitChunker mimics LangChain's RecursiveCharacterTextSplitter.
// It tries separators in order; any piece still larger than ChunkSize is
// recursively re-split with the next separator. Small pieces are merged
// together (with overlap) before being returned as final chunks.
type RecursiveSplitChunker struct {
	cfg RecursiveSplitConfig
}

func NewRecursiveSplitChunker(cfg RecursiveSplitConfig) *RecursiveSplitChunker {
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 512
	}
	if cfg.ChunkOverlap < 0 || cfg.ChunkOverlap >= cfg.ChunkSize {
		cfg.ChunkOverlap = cfg.ChunkSize / 10
	}
	if len(cfg.Separators) == 0 {
		cfg.Separators = []string{"\n\n", "\n", ". ", " ", ""}
	}
	return &RecursiveSplitChunker{cfg: cfg}
}

func (c *RecursiveSplitChunker) Chunk(text string) ([]Chunk, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	atoms := c.splitRecursive(text, c.cfg.Separators)
	merged := c.mergePieces(atoms)

	chunks := make([]Chunk, len(merged))
	for i, m := range merged {
		chunks[i] = Chunk{Index: i, Content: m}
	}
	return chunks, nil
}

// splitRecursive splits text with the first separator that works, then
// recurses on pieces that are still too large.
func (c *RecursiveSplitChunker) splitRecursive(text string, seps []string) []string {
	if len([]rune(text)) <= c.cfg.ChunkSize {
		return []string{text}
	}
	if len(seps) == 0 || seps[0] == "" {
		return c.forceSplit(text)
	}

	sep, rest := seps[0], seps[1:]
	parts := strings.Split(text, sep)

	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if len([]rune(p)) <= c.cfg.ChunkSize {
			out = append(out, p)
		} else {
			out = append(out, c.splitRecursive(p, rest)...)
		}
	}
	return out
}

// forceSplit slices text by runes when no separator helps.
func (c *RecursiveSplitChunker) forceSplit(text string) []string {
	runes := []rune(text)
	var out []string
	for i := 0; i < len(runes); i += c.cfg.ChunkSize {
		end := i + c.cfg.ChunkSize
		if end > len(runes) {
			end = len(runes)
		}
		out = append(out, string(runes[i:end]))
	}
	return out
}

// mergePieces joins small atoms into chunks no larger than ChunkSize,
// carrying ChunkOverlap runes of tail context into each new chunk.
func (c *RecursiveSplitChunker) mergePieces(pieces []string) []string {
	var merged []string
	var current []string
	currentLen := 0

	flush := func() {
		if len(current) > 0 {
			merged = append(merged, strings.Join(current, " "))
		}
	}

	for _, p := range pieces {
		pLen := len([]rune(p))
		if currentLen+pLen > c.cfg.ChunkSize && currentLen > 0 {
			flush()
			// Retain tail pieces that fit within the overlap budget.
			var tail []string
			tailLen := 0
			for i := len(current) - 1; i >= 0; i-- {
				l := len([]rune(current[i]))
				if tailLen+l > c.cfg.ChunkOverlap {
					break
				}
				tail = append([]string{current[i]}, tail...)
				tailLen += l
			}
			current, currentLen = tail, tailLen
		}
		current = append(current, p)
		currentLen += pLen
	}
	flush()
	return merged
}
