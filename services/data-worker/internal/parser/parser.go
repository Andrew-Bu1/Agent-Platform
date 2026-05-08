package parser

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"path/filepath"
	"strings"
)

// ExtractText returns the plain text content of a document given its raw bytes
// and filename (used only to determine file type by extension).
func ExtractText(data []byte, filename string) (string, error) {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".docx":
		return extractDOCX(data)
	case ".txt":
		return strings.TrimSpace(string(data)), nil
	default:
		return "", fmt.Errorf("unsupported file type: %s", filepath.Ext(filename))
	}
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────
// A DOCX file is a ZIP archive; the body text lives in word/document.xml.
// Text runs are in <w:t> elements inside <w:r> (run) inside <w:p> (paragraph).

type docxBody struct {
	Paragraphs []docxParagraph `xml:"body>p"`
}

type docxParagraph struct {
	Runs []docxRun `xml:"r"`
}

type docxRun struct {
	Texts []docxText `xml:"t"`
}

type docxText struct {
	Value string `xml:",chardata"`
}

func extractDOCX(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("docx zip.NewReader: %w", err)
	}

	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("docx open document.xml: %w", err)
		}
		defer rc.Close()

		var doc docxBody
		if err := xml.NewDecoder(rc).Decode(&doc); err != nil {
			return "", fmt.Errorf("docx xml decode: %w", err)
		}

		var sb strings.Builder
		for _, para := range doc.Paragraphs {
			var line strings.Builder
			for _, run := range para.Runs {
				for _, t := range run.Texts {
					line.WriteString(t.Value)
				}
			}
			if s := strings.TrimSpace(line.String()); s != "" {
				sb.WriteString(s)
				sb.WriteByte('\n')
			}
		}
		return strings.TrimSpace(sb.String()), nil
	}

	return "", fmt.Errorf("word/document.xml not found in docx archive")
}
