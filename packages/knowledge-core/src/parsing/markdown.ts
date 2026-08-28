export interface DocumentParser {
  /**
   * Parse a raw document string into clean text for chunking.
   */
  parse(raw: string): Promise<string>;
}

export class MarkdownParser implements DocumentParser {
  public async parse(raw: string): Promise<string> {
    // For MVP, we just strip basic markdown syntax to return clean text.
    // In a real system, this might use remark/rehype.
    let text = raw;
    
    // Remove headers
    text = text.replace(/^#{1,6}\s+/gm, '');
    
    // Remove bold/italic
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    
    // Remove links
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove images
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    
    // Remove code blocks but keep content
    text = text.replace(/```[a-z]*\n([\s\S]*?)```/g, '$1');
    
    // Remove inline code
    text = text.replace(/`([^`]+)`/g, '$1');
    
    return text.trim();
  }
}
