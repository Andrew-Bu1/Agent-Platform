package parser

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func TestExtractText_TxtFile(t *testing.T) {
	data := []byte("  hello world  ")
	got, err := ExtractText(data, "test.txt")
	if err != nil {
		t.Fatal(err)
	}
	if got != "hello world" {
		t.Errorf("expected %q, got %q", "hello world", got)
	}
}

func TestExtractText_TxtFile_Empty(t *testing.T) {
	got, err := ExtractText([]byte("   "), "empty.txt")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty string for whitespace-only txt, got %q", got)
	}
}

func TestExtractText_TxtFile_CaseInsensitiveExtension(t *testing.T) {
	// .TXT and .Txt should both be handled.
	data := []byte("UPPER CASE")
	got, err := ExtractText(data, "FILE.TXT")
	if err != nil {
		t.Fatal(err)
	}
	if got != "UPPER CASE" {
		t.Errorf("expected %q, got %q", "UPPER CASE", got)
	}
}

func TestExtractText_UnsupportedExtension(t *testing.T) {
	_, err := ExtractText([]byte("data"), "file.pdf")
	if err == nil {
		t.Fatal("expected error for unsupported extension .pdf")
	}
	if !strings.Contains(err.Error(), "unsupported file type") {
		t.Errorf("expected 'unsupported file type' in error, got: %v", err)
	}
}

func TestExtractText_DocxFile(t *testing.T) {
	data := buildMinimalDocx("Hello from docx.")
	got, err := ExtractText(data, "test.docx")
	if err != nil {
		t.Fatal(err)
	}
	if got != "Hello from docx." {
		t.Errorf("unexpected content: %q", got)
	}
}

func TestExtractText_DocxFile_EmptyParagraph(t *testing.T) {
	// A docx with a single empty <t> element should return an empty string.
	data := buildMinimalDocx("")
	got, err := ExtractText(data, "empty.docx")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

func TestExtractText_DocxFile_MultipleParagraphs(t *testing.T) {
	data := buildDocxWithParagraphs("First line.", "Second line.")
	got, err := ExtractText(data, "multi.docx")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "First line.") {
		t.Errorf("expected 'First line.' in output, got %q", got)
	}
	if !strings.Contains(got, "Second line.") {
		t.Errorf("expected 'Second line.' in output, got %q", got)
	}
}

func TestExtractText_DocxFile_InvalidZip(t *testing.T) {
	_, err := ExtractText([]byte("not a zip archive"), "bad.docx")
	if err == nil {
		t.Fatal("expected error for invalid docx (not a valid ZIP)")
	}
}

func TestExtractText_DocxFile_MissingDocumentXML(t *testing.T) {
	// A ZIP that doesn't contain word/document.xml.
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("other_file.txt")
	f.Write([]byte("irrelevant"))
	zw.Close()

	_, err := ExtractText(buf.Bytes(), "no_doc_xml.docx")
	if err == nil {
		t.Fatal("expected error when word/document.xml is absent")
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// buildMinimalDocx returns a valid .docx ZIP containing word/document.xml with
// a single paragraph holding the given text.
func buildMinimalDocx(text string) []byte {
	return buildDocxWithParagraphs(text)
}

// buildDocxWithParagraphs creates a .docx ZIP with one paragraph per text argument.
func buildDocxWithParagraphs(paragraphs ...string) []byte {
	var pElements strings.Builder
	for _, p := range paragraphs {
		pElements.WriteString("<p><r><t>")
		pElements.WriteString(p)
		pElements.WriteString("</t></r></p>")
	}

	xmlContent := `<?xml version="1.0" encoding="UTF-8"?>` +
		`<document><body>` +
		pElements.String() +
		`</body></document>`

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("word/document.xml")
	f.Write([]byte(xmlContent))
	zw.Close()
	return buf.Bytes()
}
