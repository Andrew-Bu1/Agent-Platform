package chunker

import (
	"encoding/json"
	"math"
	"testing"
)

// ─── FixedSizeChunker ──────────────────────────────────────────────────────────

func TestFixedSize_DefaultChunkSize(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{})
	if c.cfg.ChunkSize != 512 {
		t.Errorf("expected ChunkSize=512, got %d", c.cfg.ChunkSize)
	}
}

func TestFixedSize_OverlapExceedsSize_ClampedToTenth(t *testing.T) {
	// ChunkOverlap >= ChunkSize → clamped to ChunkSize/10
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 100, ChunkOverlap: 100})
	if c.cfg.ChunkOverlap != 10 {
		t.Errorf("expected overlap=10, got %d", c.cfg.ChunkOverlap)
	}
}

func TestFixedSize_EmptyText(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 10, ChunkOverlap: 0})
	chunks, err := c.Chunk("")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for empty text, got %d", len(chunks))
	}
}

func TestFixedSize_WhitespaceOnlyText(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 10, ChunkOverlap: 0})
	chunks, err := c.Chunk("   \n\t  ")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for whitespace-only text, got %d", len(chunks))
	}
}

func TestFixedSize_TextShorterThanChunkSize(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 512, ChunkOverlap: 50})
	chunks, err := c.Chunk("hello world")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Content != "hello world" {
		t.Errorf("unexpected content: %q", chunks[0].Content)
	}
}

func TestFixedSize_ExactChunkSize(t *testing.T) {
	// Text is exactly ChunkSize runes → one chunk, no remainder.
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 10, ChunkOverlap: 0})
	chunks, err := c.Chunk("abcdefghij") // 10 runes
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Content != "abcdefghij" {
		t.Errorf("unexpected content: %q", chunks[0].Content)
	}
}

func TestFixedSize_TwoChunksNoOverlap(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 10, ChunkOverlap: 0})
	chunks, err := c.Chunk("abcdefghijklmnopqrst") // 20 runes
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}
	if chunks[0].Content != "abcdefghij" {
		t.Errorf("chunk[0] = %q", chunks[0].Content)
	}
	if chunks[1].Content != "klmnopqrst" {
		t.Errorf("chunk[1] = %q", chunks[1].Content)
	}
}

func TestFixedSize_WithOverlap(t *testing.T) {
	// size=5, overlap=2, step=3 → "abcdefgh" (8 runes) → ["abcde", "defgh"]
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 5, ChunkOverlap: 2})
	chunks, err := c.Chunk("abcdefgh")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}
	if chunks[0].Content != "abcde" {
		t.Errorf("chunk[0] = %q", chunks[0].Content)
	}
	if chunks[1].Content != "defgh" {
		t.Errorf("chunk[1] = %q", chunks[1].Content)
	}
}

func TestFixedSize_ChunkIndexesAreSequential(t *testing.T) {
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 5, ChunkOverlap: 0})
	chunks, _ := c.Chunk("aaaaabbbbbcccccdddddeeeee") // 25 runes → 5 chunks
	if len(chunks) != 5 {
		t.Fatalf("expected 5 chunks, got %d", len(chunks))
	}
	for i, ch := range chunks {
		if ch.Index != i {
			t.Errorf("chunk[%d].Index = %d", i, ch.Index)
		}
	}
}

func TestFixedSize_UnicodeRuneBasedSplit(t *testing.T) {
	// 7 runes, ChunkSize=3, overlap=0, step=3 → 3 chunks
	c := NewFixedSizeChunker(FixedSizeConfig{ChunkSize: 3, ChunkOverlap: 0})
	chunks, err := c.Chunk("xinchao") // x-i-n-c-h-a-o = 7 ASCII runes
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}
	if chunks[0].Content != "xin" {
		t.Errorf("chunk[0] = %q", chunks[0].Content)
	}
	if chunks[1].Content != "cha" {
		t.Errorf("chunk[1] = %q", chunks[1].Content)
	}
	if chunks[2].Content != "o" {
		t.Errorf("chunk[2] = %q", chunks[2].Content)
	}
}

// ─── RecursiveSplitChunker ─────────────────────────────────────────────────────

func TestRecursiveSplit_DefaultChunkSize(t *testing.T) {
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{})
	if c.cfg.ChunkSize != 512 {
		t.Errorf("expected default ChunkSize=512, got %d", c.cfg.ChunkSize)
	}
}

func TestRecursiveSplit_DefaultSeparators(t *testing.T) {
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{})
	if len(c.cfg.Separators) == 0 {
		t.Fatal("expected default separators to be non-empty")
	}
	if c.cfg.Separators[0] != "\n\n" {
		t.Errorf("expected first separator \\n\\n, got %q", c.cfg.Separators[0])
	}
}

func TestRecursiveSplit_EmptyText(t *testing.T) {
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{ChunkSize: 100})
	chunks, err := c.Chunk("")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for empty text, got %d", len(chunks))
	}
}

func TestRecursiveSplit_SplitsByParagraph(t *testing.T) {
	// Each paragraph is ~16-17 runes; ChunkSize=20 prevents merging across paragraphs.
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{ChunkSize: 20, ChunkOverlap: 0})
	text := "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
	chunks, err := c.Chunk(text)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d: %v", len(chunks), chunks)
	}
}

func TestRecursiveSplit_ForceSplitWhenNoSeparatorMatches(t *testing.T) {
	// "abcdef" has no \n\n, \n, or space → falls through to forceSplit.
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{
		ChunkSize:    3,
		ChunkOverlap: 0,
		Separators:   []string{"\n\n", "\n", " "},
	})
	chunks, err := c.Chunk("abcdef")
	if err != nil {
		t.Fatal(err)
	}
	// forceSplit: "abc", "def" → 2 chunks of 3 runes each
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks from forceSplit, got %d", len(chunks))
	}
	if chunks[0].Content != "abc" {
		t.Errorf("chunk[0] = %q", chunks[0].Content)
	}
	if chunks[1].Content != "def" {
		t.Errorf("chunk[1] = %q", chunks[1].Content)
	}
}

func TestRecursiveSplit_ChunkIndexesAreSequential(t *testing.T) {
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{ChunkSize: 20, ChunkOverlap: 0})
	chunks, _ := c.Chunk("one two\n\nthree four\n\nfive six")
	for i, ch := range chunks {
		if ch.Index != i {
			t.Errorf("chunk[%d].Index = %d", i, ch.Index)
		}
	}
}

func TestRecursiveSplit_TextShorterThanChunkSize(t *testing.T) {
	c := NewRecursiveSplitChunker(RecursiveSplitConfig{ChunkSize: 100, ChunkOverlap: 0})
	chunks, err := c.Chunk("short text")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
}

// ─── SemanticChunker ───────────────────────────────────────────────────────────

func TestSemanticChunker_DefaultMaxChunkSize(t *testing.T) {
	c := NewSemanticChunker(SemanticChunkingConfig{})
	if c.cfg.MaxChunkSize != 1024 {
		t.Errorf("expected MaxChunkSize=1024, got %d", c.cfg.MaxChunkSize)
	}
}

func TestSemanticChunker_DefaultSimilarityThreshold(t *testing.T) {
	c := NewSemanticChunker(SemanticChunkingConfig{})
	if c.cfg.SimilarityThreshold != 0.4 {
		t.Errorf("expected SimilarityThreshold=0.4, got %f", c.cfg.SimilarityThreshold)
	}
}

func TestSemanticChunker_EmptyText(t *testing.T) {
	c := NewSemanticChunker(SemanticChunkingConfig{MaxChunkSize: 100, SimilarityThreshold: 0.5})
	chunks, err := c.Chunk("")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for empty text, got %d", len(chunks))
	}
}

func TestSemanticChunker_SingleSentenceOneChunk(t *testing.T) {
	c := NewSemanticChunker(SemanticChunkingConfig{MaxChunkSize: 1024, SimilarityThreshold: 0.4})
	chunks, err := c.Chunk("Hello world.")
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Index != 0 {
		t.Errorf("expected Index=0, got %d", chunks[0].Index)
	}
}

func TestSemanticChunker_SimilarSentencesMerged(t *testing.T) {
	// Low threshold → highly similar sentences merge into one chunk.
	c := NewSemanticChunker(SemanticChunkingConfig{MaxChunkSize: 1024, SimilarityThreshold: 0.1})
	text := "The cat sat on the mat. The cat sat on the mat again."
	chunks, err := c.Chunk(text)
	if err != nil {
		t.Fatal(err)
	}
	// The two sentences share many words → cosine ≈ 0.83 > 0.1 → merged into 1 chunk.
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk (merged), got %d", len(chunks))
	}
}

func TestSemanticChunker_DissimilarSentencesSplit(t *testing.T) {
	// Very high threshold (0.99) forces every sentence to be its own chunk.
	c := NewSemanticChunker(SemanticChunkingConfig{MaxChunkSize: 1024, SimilarityThreshold: 0.99})
	text := "The cat sat on the mat. Quantum mechanics governs subatomic particles."
	chunks, err := c.Chunk(text)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected ≥2 chunks for dissimilar sentences, got %d", len(chunks))
	}
}

func TestSemanticChunker_MaxSizeRespected(t *testing.T) {
	// Even with similarity >= threshold, if combined length > MaxChunkSize the merge must be skipped.
	c := NewSemanticChunker(SemanticChunkingConfig{MaxChunkSize: 20, SimilarityThreshold: 0.0})
	text := "Hello world there. Hello world here."
	chunks, err := c.Chunk(text)
	if err != nil {
		t.Fatal(err)
	}
	for _, ch := range chunks {
		if len([]rune(ch.Content)) > 20 {
			t.Errorf("chunk exceeds MaxChunkSize=20: len=%d content=%q",
				len([]rune(ch.Content)), ch.Content)
		}
	}
}

// ─── splitSentences ────────────────────────────────────────────────────────────

func TestSplitSentences_PeriodSpace(t *testing.T) {
	got := splitSentences("Hello world. Goodbye world.")
	if len(got) < 1 {
		t.Fatalf("expected ≥1 sentence, got 0")
	}
}

func TestSplitSentences_EmptyString(t *testing.T) {
	got := splitSentences("")
	if len(got) != 0 {
		t.Errorf("expected 0 sentences for empty string, got %v", got)
	}
}

func TestSplitSentences_ExclamationMark(t *testing.T) {
	got := splitSentences("Wow! Amazing! Really!")
	// "Wow!⌀Amazing!⌀Really!" → 3 sentences after split
	if len(got) < 2 {
		t.Fatalf("expected ≥2 sentences for exclamation marks, got %v", got)
	}
}

func TestSplitSentences_QuestionMark(t *testing.T) {
	got := splitSentences("Why? Because.")
	if len(got) < 2 {
		t.Fatalf("expected ≥2 sentences for question mark, got %v", got)
	}
}

// ─── cosineSimilarity ──────────────────────────────────────────────────────────

func TestCosineSimilarity_IdenticalStrings(t *testing.T) {
	sim := cosineSimilarity("cat sat mat", "cat sat mat")
	// Allow a small epsilon for floating-point rounding (sqrt(n)*sqrt(n) != n exactly).
	if math.Abs(sim-1.0) > 1e-9 {
		t.Errorf("expected ~1.0 for identical strings, got %f", sim)
	}
}

func TestCosineSimilarity_DisjointStrings(t *testing.T) {
	sim := cosineSimilarity("alpha beta gamma", "delta epsilon zeta")
	if sim != 0.0 {
		t.Errorf("expected 0.0 for disjoint strings, got %f", sim)
	}
}

func TestCosineSimilarity_EmptyStrings(t *testing.T) {
	sim := cosineSimilarity("", "hello world")
	if sim != 0.0 {
		t.Errorf("expected 0.0 when one string is empty, got %f", sim)
	}
}

func TestCosineSimilarity_PartialOverlap(t *testing.T) {
	// "cat sat on mat" vs "dog sat on floor" share "sat" and "on"
	sim := cosineSimilarity("cat sat on mat", "dog sat on floor")
	if sim <= 0.0 || sim >= 1.0 {
		t.Errorf("expected partial similarity in (0,1), got %f", sim)
	}
}

// ─── New (factory) ─────────────────────────────────────────────────────────────

func TestNew_FixedSize(t *testing.T) {
	c, err := New("fixed_size", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := c.(*FixedSizeChunker); !ok {
		t.Errorf("expected *FixedSizeChunker, got %T", c)
	}
}

func TestNew_RecursiveSplit(t *testing.T) {
	c, err := New("recursive_split", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := c.(*RecursiveSplitChunker); !ok {
		t.Errorf("expected *RecursiveSplitChunker, got %T", c)
	}
}

func TestNew_SemanticChunking(t *testing.T) {
	c, err := New("semantic_chunking", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := c.(*SemanticChunker); !ok {
		t.Errorf("expected *SemanticChunker, got %T", c)
	}
}

func TestNew_UnknownStrategy(t *testing.T) {
	_, err := New("unknown_strategy", nil)
	if err == nil {
		t.Fatal("expected error for unknown strategy")
	}
}

func TestNew_FixedSizeWithConfig(t *testing.T) {
	rawCfg, _ := json.Marshal(FixedSizeConfig{ChunkSize: 256, ChunkOverlap: 10})
	c, err := New("fixed_size", rawCfg)
	if err != nil {
		t.Fatal(err)
	}
	fc := c.(*FixedSizeChunker)
	if fc.cfg.ChunkSize != 256 {
		t.Errorf("expected ChunkSize=256, got %d", fc.cfg.ChunkSize)
	}
	if fc.cfg.ChunkOverlap != 10 {
		t.Errorf("expected ChunkOverlap=10, got %d", fc.cfg.ChunkOverlap)
	}
}

func TestNew_SemanticChunkingWithConfig(t *testing.T) {
	rawCfg, _ := json.Marshal(SemanticChunkingConfig{MaxChunkSize: 512, SimilarityThreshold: 0.7})
	c, err := New("semantic_chunking", rawCfg)
	if err != nil {
		t.Fatal(err)
	}
	sc := c.(*SemanticChunker)
	if sc.cfg.MaxChunkSize != 512 {
		t.Errorf("expected MaxChunkSize=512, got %d", sc.cfg.MaxChunkSize)
	}
	if sc.cfg.SimilarityThreshold != 0.7 {
		t.Errorf("expected SimilarityThreshold=0.7, got %f", sc.cfg.SimilarityThreshold)
	}
}
