/**
 * Safely parse JSON from LLM output.
 * LLMs often wrap JSON in markdown code fences like:
 *   ```json
 *   { "key": "value" }
 *   ```
 * This utility strips those fences before parsing.
 */
export function safeParseLLMJson(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // Sometimes LLM adds text before/after JSON. Try to extract the JSON object/array.
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonStart = cleaned.search(/[\[{]/);
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // Find the matching closing bracket
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    const closingChar = cleaned.startsWith('{') ? '}' : ']';
    const lastClose = cleaned.lastIndexOf(closingChar);
    if (lastClose !== -1) {
      cleaned = cleaned.slice(0, lastClose + 1);
    }
  }

  return JSON.parse(cleaned);
}
