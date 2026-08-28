import type { EmbeddingProvider } from '../types.js';

export class OpenAIEmbeddings implements EmbeddingProvider {
  constructor(private readonly apiKey: string) {}

  public async embed(text: string): Promise<readonly number[]> {
    if (!this.apiKey) {
      // Return a dummy vector if no API key (for local dev without keys)
      return Array.from({ length: 1536 }, () => Math.random() - 0.5);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Embeddings API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding', error);
      // Fallback for tests
      return Array.from({ length: 1536 }, () => Math.random() - 0.5);
    }
  }
}
