import type { DocumentParser } from './markdown.js';

/**
 * A code file parser that removes multi-line comments but preserves single-line comments.
 */
export class CodeParser implements DocumentParser {
  /** The language of the code file. */
  public readonly language: string;

  /**
   * Creates a CodeParser.
   * @param language Optional language of the code file.
   */
  constructor(language = 'unknown') {
    this.language = language;
  }

  /**
   * Parses the raw code string, removing multi-line comments.
   * @param raw The raw code.
   */
  public async parse(raw: string): Promise<string> {
    // Remove multi-line comments /* */
    let parsed = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return parsed.trim();
  }
}
