import type { DocumentParser } from './markdown.js';

/**
 * A stub parser for PDF text extraction.
 */
export class PDFParser implements DocumentParser {
  /**
   * Parses a raw PDF text string (assumed already extracted for this stub).
   * Strips common PDF artifacts.
   * @param raw The raw text from the PDF.
   */
  public async parse(raw: string): Promise<string> {
    // Strip form feeds
    let text = raw.replace(/\f/g, '');
    
    // Normalize excessive whitespace and line endings
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+$/gm, '');

    return text.trim();
  }
}
