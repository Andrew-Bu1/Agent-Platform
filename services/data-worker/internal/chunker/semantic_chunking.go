package chunker

import (
	"math"
	"strings"
)

// SemanticChunker groups sentences into chunks as long as adjacent sentences
// are semantically similar (cosine similarity of TF bag-of-words vectors) AND
// the combined length stays within MaxChunkSize runes.
// For production, replace cosineSimilarity with real embedding-based similarity.
type SemanticChunker struct {
	cfg SemanticChunkingConfig
}

func NewSemanticChunker(cfg SemanticChunkingConfig) *SemanticChunker {
	if cfg.MaxChunkSize <= 0 {
		cfg.MaxChunkSize = 1024
	}
	if cfg.SimilarityThreshold <= 0 {
		cfg.SimilarityThreshold = 0.4
	}
	return &SemanticChunker{cfg: cfg}
}

func (c *SemanticChunker) Chunk(text string) ([]Chunk, error) {
	sentences := splitSentences(strings.TrimSpace(text))
	if len(sentences) == 0 {
		return nil, nil
	}

	var chunks []Chunk
	idx := 0
	current := sentences[0]

	for i := 1; i < len(sentences); i++ {
		next := sentences[i]
		sim := cosineSimilarity(current, next)
		combinedLen := len([]rune(current)) + 1 + len([]rune(next))

		if sim >= c.cfg.SimilarityThreshold && combinedLen <= c.cfg.MaxChunkSize {
			current += " " + next
		} else {
			if s := strings.TrimSpace(current); s != "" {
				chunks = append(chunks, Chunk{Index: idx, Content: s})
				idx++
			}
			current = next
		}
	}
	if s := strings.TrimSpace(current); s != "" {
		chunks = append(chunks, Chunk{Index: idx, Content: s})
	}
	return chunks, nil
}

// splitSentences splits on common sentence-ending punctuation followed by whitespace.
func splitSentences(text string) []string {
	for _, punct := range []string{". ", "! ", "? ", ".\n", "!\n", "?\n"} {
		text = strings.ReplaceAll(text, punct, punct[:1]+"⌀")
	}
	raw := strings.Split(text, "⌀")
	out := make([]string, 0, len(raw))
	for _, s := range raw {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// cosineSimilarity computes the cosine similarity between two strings using
// bag-of-words term-frequency vectors.
func cosineSimilarity(a, b string) float64 {
	va := termFreq(a)
	vb := termFreq(b)

	var dot, normA, normB float64
	for term, fa := range va {
		dot += fa * vb[term]
		normA += fa * fa
	}
	for _, fb := range vb {
		normB += fb * fb
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

func termFreq(s string) map[string]float64 {
	words := strings.Fields(strings.ToLower(s))
	freq := make(map[string]float64, len(words))
	for _, w := range words {
		freq[w]++
	}
	return freq
}
