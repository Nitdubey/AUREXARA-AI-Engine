export class InputValidator {
  /**
   * Basic heuristic check for prompt injection attempts.
   */
  public async validate(input: string): Promise<{ valid: boolean; reason?: string }> {
    const lowerInput = input.toLowerCase();
    
    // Heuristic blacklist (MVP)
    const blockedPhrases = [
      'ignore all previous instructions',
      'system prompt',
      'you are now',
      'bypass',
      'disregard previous'
    ];

    for (const phrase of blockedPhrases) {
      if (lowerInput.includes(phrase)) {
        return { valid: false, reason: `Blocked by heuristic: suspicious phrase detected.` };
      }
    }

    return { valid: true };
  }
}

export class OutputFilter {
  /**
   * Scans LLM output for sensitive information or PII.
   */
  public async filter(output: string): Promise<string> {
    let sanitized = output;

    // Basic heuristic: Mask potential credit card numbers (13-19 digits)
    // Note: A real system would use a robust NER model like Presidio for PII
    sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_NUMBER]');
    
    // Mask potential SSNs
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

    return sanitized;
  }
}
