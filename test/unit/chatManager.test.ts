import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ChatManager } from '../../src/ai/chatManager';

describe('ChatManager (Context-Aware AI Chat)', () => {
  let mockAiManager: any;
  let chatManager: ChatManager;

  beforeEach(() => {
    (ChatManager as any).instance = undefined;
    mockAiManager = {
      streamChat: vi.fn().mockImplementation(async (prompt, onChunk) => {
        onChunk('Hello! How can I help you?');
        return 'Hello! How can I help you?';
      }),
      isConfigured: vi.fn().mockResolvedValue(true),
    };
    chatManager = ChatManager.initialize(mockAiManager);
  });

  it('should initialize and have empty message list initially', () => {
    expect(chatManager.getMessages()).toEqual([]);
  });

  it('should send user message, store it, and stream response', async () => {
    const chunks: string[] = [];
    const response = await chatManager.sendMessage('How do I refactor this?', (chunk) => {
      chunks.push(chunk);
    });

    expect(response).toBe('Hello! How can I help you?');
    expect(chunks.length).toBeGreaterThan(0);

    const messages = chatManager.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('How do I refactor this?');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello! How can I help you?');
  });

  it('should redact sensitive secrets from chat prompts before sending', async () => {
    const rawPrompt = 'Here is my key: AIzaSyD12345678901234567890123456789012';
    await chatManager.sendMessage(rawPrompt, () => {});

    const messages = chatManager.getMessages();
    expect(messages[0].content).toContain('[REDACTED_GEMINI_KEY]');
    expect(messages[0].content).not.toContain('AIzaSyD12345678901234567890123456789012');
  });

  it('should clear chat messages when requested', async () => {
    await chatManager.sendMessage('test', () => {});
    expect(chatManager.getMessages().length).toBe(2);

    chatManager.clearMessages();
    expect(chatManager.getMessages().length).toBe(0);
  });
});
