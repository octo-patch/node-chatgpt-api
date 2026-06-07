import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import MiniMaxClient from '../src/MiniMaxClient.js';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;

describe('MiniMaxClient Integration Tests', { skip: !MINIMAX_API_KEY ? 'MINIMAX_API_KEY not set' : false }, () => {
    let client;

    before(() => {
        client = new MiniMaxClient(MINIMAX_API_KEY, {
            modelOptions: {
                model: 'MiniMax-M3',
                temperature: 0,
                max_tokens: 256,
            },
            maxContextTokens: 4096,
        });
    });

    it('should send a message and receive a response', async () => {
        const result = await client.sendMessage('Reply with exactly: "Hello from MiniMax"');
        assert.ok(result.response);
        assert.ok(result.conversationId);
        assert.ok(result.messageId);
        assert.ok(typeof result.response === 'string');
        assert.ok(result.response.length > 0);
    });

    it('should support streaming responses', async () => {
        const tokens = [];
        const result = await client.sendMessage('Say "streaming works" and nothing else.', {
            onProgress: (token) => {
                tokens.push(token);
            },
        });
        assert.ok(result.response);
        assert.ok(tokens.length > 0, 'Should have received streaming tokens');
    });

    it('should maintain conversation context', async () => {
        const first = await client.sendMessage('My favorite color is blue. Remember this.');
        assert.ok(first.response);

        const second = await client.sendMessage('What is my favorite color? Reply with just the color.', {
            conversationId: first.conversationId,
            parentMessageId: first.messageId,
        });
        assert.ok(second.response.toLowerCase().includes('blue'));
    });
});
