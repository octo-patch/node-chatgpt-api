import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import MiniMaxClient from '../src/MiniMaxClient.js';

describe('MiniMaxClient', () => {
    let client;

    beforeEach(() => {
        client = new MiniMaxClient('test-api-key', {
            modelOptions: { model: 'MiniMax-M3' },
        });
    });

    describe('constructor', () => {
        it('should create a MiniMaxClient instance', () => {
            assert.ok(client instanceof MiniMaxClient);
        });

        it('should set the API key', () => {
            assert.equal(client.apiKey, 'test-api-key');
        });

        it('should use MiniMax-M3 as the default model', () => {
            const defaultClient = new MiniMaxClient('key');
            assert.equal(defaultClient.modelOptions.model, 'MiniMax-M3');
        });

        it('should allow overriding the model', () => {
            const customClient = new MiniMaxClient('key', {
                modelOptions: { model: 'MiniMax-M2.7-highspeed' },
            });
            assert.equal(customClient.modelOptions.model, 'MiniMax-M2.7-highspeed');
        });

        it('should allow selecting MiniMax-M2.7', () => {
            const customClient = new MiniMaxClient('key', {
                modelOptions: { model: 'MiniMax-M2.7' },
            });
            assert.equal(customClient.modelOptions.model, 'MiniMax-M2.7');
        });
    });

    describe('setOptions', () => {
        it('should set completions URL to MiniMax API endpoint', () => {
            assert.equal(client.completionsUrl, 'https://api.minimax.io/v1/chat/completions');
        });

        it('should use reverseProxyUrl when provided', () => {
            const proxyClient = new MiniMaxClient('key', {
                reverseProxyUrl: 'https://my-proxy.example.com/v1/chat/completions',
            });
            assert.equal(proxyClient.completionsUrl, 'https://my-proxy.example.com/v1/chat/completions');
        });

        it('should set isChatGptModel to true for Chat Completions API', () => {
            assert.equal(client.isChatGptModel, true);
        });

        it('should set isUnofficialChatGptModel to false', () => {
            assert.equal(client.isUnofficialChatGptModel, false);
        });

        it('should set default maxContextTokens to 512K', () => {
            assert.equal(client.maxContextTokens, 512000);
        });

        it('should set default maxResponseTokens to 4096', () => {
            assert.equal(client.maxResponseTokens, 4096);
        });

        it('should set chatGptLabel to MiniMax by default', () => {
            assert.equal(client.chatGptLabel, 'MiniMax');
        });

        it('should allow custom chatGptLabel', () => {
            const customClient = new MiniMaxClient('key', { chatGptLabel: 'MyBot' });
            assert.equal(customClient.chatGptLabel, 'MyBot');
        });

        it('should use minimaxApiKey from options', () => {
            const customClient = new MiniMaxClient('initial-key', {
                minimaxApiKey: 'overridden-key',
            });
            assert.equal(customClient.apiKey, 'overridden-key');
        });
    });

    describe('temperature clamping', () => {
        it('should clamp temperature above 1 to 1', () => {
            const hotClient = new MiniMaxClient('key', {
                modelOptions: { temperature: 1.5 },
            });
            assert.equal(hotClient.modelOptions.temperature, 1);
        });

        it('should clamp temperature below 0 to 0', () => {
            const coldClient = new MiniMaxClient('key', {
                modelOptions: { temperature: -0.5 },
            });
            assert.equal(coldClient.modelOptions.temperature, 0);
        });

        it('should accept temperature=0', () => {
            const zeroClient = new MiniMaxClient('key', {
                modelOptions: { temperature: 0 },
            });
            assert.equal(zeroClient.modelOptions.temperature, 0);
        });

        it('should accept temperature=1', () => {
            const oneClient = new MiniMaxClient('key', {
                modelOptions: { temperature: 1 },
            });
            assert.equal(oneClient.modelOptions.temperature, 1);
        });

        it('should accept temperature in valid range', () => {
            const normalClient = new MiniMaxClient('key', {
                modelOptions: { temperature: 0.7 },
            });
            assert.equal(normalClient.modelOptions.temperature, 0.7);
        });

        it('should use default temperature of 0.8', () => {
            assert.equal(client.modelOptions.temperature, 0.8);
        });
    });

    describe('model options', () => {
        it('should set default presence_penalty to 0', () => {
            assert.equal(client.modelOptions.presence_penalty, 0);
        });

        it('should set default top_p to 1', () => {
            assert.equal(client.modelOptions.top_p, 1);
        });

        it('should use cl100k_base tokenizer', () => {
            assert.ok(client.gptEncoder);
        });

        it('should allow custom maxContextTokens', () => {
            const customClient = new MiniMaxClient('key', {
                maxContextTokens: 200000,
            });
            assert.equal(customClient.maxContextTokens, 200000);
        });

        it('should allow custom max_tokens', () => {
            const customClient = new MiniMaxClient('key', {
                modelOptions: { max_tokens: 2048 },
            });
            assert.equal(customClient.maxResponseTokens, 2048);
        });
    });

    describe('buildPrompt', () => {
        it('should build chat messages array with proper roles', async () => {
            const messages = [
                { id: '1', parentMessageId: '0', role: 'User', message: 'Hello' },
            ];
            const result = await client.buildPrompt(messages, '1');
            assert.ok(Array.isArray(result.prompt));
            assert.equal(result.prompt.length, 2); // system + user message
            assert.equal(result.prompt[0].role, 'system');
            assert.equal(result.prompt[1].role, 'user');
            assert.equal(result.prompt[1].content, 'Hello');
        });

        it('should build multi-turn conversation with user/assistant roles', async () => {
            const messages = [
                { id: '1', parentMessageId: '0', role: 'User', message: 'Hi' },
                { id: '2', parentMessageId: '1', role: 'ChatGPT', message: 'Hello!' },
                { id: '3', parentMessageId: '2', role: 'User', message: 'How are you?' },
            ];
            const result = await client.buildPrompt(messages, '3');
            assert.ok(Array.isArray(result.prompt));
            assert.equal(result.prompt.length, 4); // system + 3 messages
            assert.equal(result.prompt[0].role, 'system');
            assert.equal(result.prompt[1].role, 'user');
            assert.equal(result.prompt[2].role, 'assistant');
            assert.equal(result.prompt[3].role, 'user');
        });

        it('should use custom promptPrefix', async () => {
            const messages = [
                { id: '1', parentMessageId: '0', role: 'User', message: 'Hello' },
            ];
            const result = await client.buildPrompt(messages, '1', { promptPrefix: 'You are a pirate.' });
            assert.equal(result.prompt[0].content, 'You are a pirate.');
        });
    });

    describe('stop tokens', () => {
        it('should set default stop tokens', () => {
            assert.ok(Array.isArray(client.modelOptions.stop));
            assert.ok(client.modelOptions.stop.includes('||>'));
            assert.ok(client.modelOptions.stop.includes('\nUser:'));
            assert.ok(client.modelOptions.stop.includes('<|diff_marker|>'));
        });

        it('should allow custom stop tokens', () => {
            const customClient = new MiniMaxClient('key', {
                modelOptions: { stop: ['<stop>'] },
            });
            assert.deepEqual(customClient.modelOptions.stop, ['<stop>']);
        });
    });

    describe('maxPromptTokens validation', () => {
        it('should throw if maxPromptTokens + max_tokens > maxContextTokens', () => {
            assert.throws(() => {
                // eslint-disable-next-line no-new
                new MiniMaxClient('key', {
                    maxContextTokens: 100,
                    maxPromptTokens: 90,
                    modelOptions: { max_tokens: 50 },
                });
            }, /must be less than or equal to maxContextTokens/);
        });
    });
});
