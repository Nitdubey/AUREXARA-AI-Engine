/** Roles in a conversation. */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/** Content block within a message — supports text and images. */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/** Image content block within a message. */
export interface ImageContent {
  readonly type: 'image';
  readonly url: string;
  readonly detail?: 'auto' | 'low' | 'high';
}

/** Union type representing the content of a message block. */
export type MessageContent = TextContent | ImageContent;

/** A tool call requested by the model. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string; // JSON string
}

/** A single message in a conversation. */
export interface Message {
  readonly role: Role;
  readonly content: string | MessageContent[];
  readonly name?: string;
  readonly toolCallId?: string;
  readonly toolCalls?: ToolCall[];
}

/** Tool definition for function calling. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>; // JSON Schema
  readonly strict?: boolean;
}
