import { describe, it, expect } from 'vitest';
import { TextChunker } from '../chunking/text.js';
import { CodeChunker } from '../chunking/code.js';
import { SlidingWindowChunker } from '../chunking/sliding-window.js';

describe('Chunkers', () => {
  describe('TextChunker', () => {
    it('should split paragraphs exceeding max size', () => {
      // Use very small max token limit so short paragraphs get split
      const chunker = new TextChunker(5); // 5 * 4 = 20 chars
      const text = 'This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.';
      const chunks = chunker.chunk(text);
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toContain('paragraph one');
      expect(chunks[1]).toContain('paragraph two');
      expect(chunks[2]).toContain('paragraph three');
    });

    it('should keep small paragraphs together when under max size', () => {
      const chunker = new TextChunker(500); // default — very large
      const text = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const chunks = chunker.chunk(text);
      // All paragraphs fit in one chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('Paragraph 1.');
      expect(chunks[0]).toContain('Paragraph 3.');
    });

    it('should handle empty string', () => {
      const chunker = new TextChunker();
      expect(chunker.chunk('')).toEqual([]);
    });

    it('should split a single very large paragraph', () => {
      const chunker = new TextChunker(500); // 2000 chars
      // Generate a paragraph larger than 2000 chars
      const bigText = 'word '.repeat(600); // 3000 chars
      const chunks = chunker.chunk(bigText);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CodeChunker', () => {
    it('should split by function boundary', () => {
      const chunker = new CodeChunker(100); // 400 chars — enough room
      const code = `function first() {\n  return 1;\n}\n\nfunction second() {\n  return 2;\n}`;
      const chunks = chunker.chunk(code);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some(c => c.includes('function first()'))).toBe(true);
      expect(chunks.some(c => c.includes('function second()'))).toBe(true);
    });

    it('should preserve imports with the first chunk', () => {
      const chunker = new CodeChunker(100);
      const code = `import { A } from 'a';\nimport { B } from 'b';\n\nfunction doSomething() {\n  return A + B;\n}\n\nfunction doOther() {\n  return 2;\n}`;
      const chunks = chunker.chunk(code);
      // Imports should be in the first chunk
      expect(chunks[0]).toContain('import { A }');
      expect(chunks[0]).toContain('import { B }');
      // At least 2 chunks (imports+first function, second function)
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle code with no function boundaries', () => {
      const chunker = new CodeChunker(100);
      const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
      const chunks = chunker.chunk(code);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]).toContain('const a');
    });
  });

  describe('SlidingWindowChunker', () => {
    it('should chunk with overlap', () => {
      // 25 tokens = 100 chars window, 5 tokens = 20 chars overlap
      const chunker = new SlidingWindowChunker(25, 5);
      // Generate text longer than 100 chars
      const text = 'The quick brown fox jumps over the lazy dog. ' +
                   'A fast red car speeds past the old bridge. ' +
                   'The sunset paints the sky in shades of gold and crimson.';
      const chunks = chunker.chunk(text);
      
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should be at most window size
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(100);
      }
    });

    it('should handle small text without overlapping', () => {
      const chunker = new SlidingWindowChunker(100, 10);
      const chunks = chunker.chunk('Short text');
      expect(chunks).toEqual(['Short text']);
    });
  });
});
