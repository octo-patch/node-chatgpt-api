// eslint-disable-next-line no-unused-vars
import { KeyvFile } from 'keyv-file';
// import { MiniMaxClient } from '@waylaidwanderer/chatgpt-api';
import { MiniMaxClient } from '../index.js';

const clientOptions = {
    // (Optional) Parameters for MiniMax's OpenAI-compatible API
    modelOptions: {
        // Available models: 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed'
        model: 'MiniMax-M2.7',
        // MiniMax supports temperature in the range [0, 1].
        temperature: 0,
        // Set max_tokens here to override the default max_tokens of 4096 for the completion.
        // max_tokens: 4096,
    },
    // (Optional) MiniMax-M2.7 supports up to 1M context tokens.
    // maxContextTokens: 1000000,
    // (Optional) Set custom instructions.
    // promptPrefix: 'You are a helpful AI assistant powered by MiniMax...',
    // (Optional) Set a custom name for the AI
    // chatGptLabel: 'MiniMax',
    // (Optional) Set to true to enable `console.debug()` logging
    debug: false,
};

const cacheOptions = {
    // Options for the Keyv cache, see https://www.npmjs.com/package/keyv
    // For example, to use a JSON file (`npm i keyv-file`) as a database:
    // store: new KeyvFile({ filename: 'cache.json' }),
};

const miniMaxClient = new MiniMaxClient('YOUR_MINIMAX_API_KEY', clientOptions, cacheOptions);

let response;
response = await miniMaxClient.sendMessage('Hello!');
console.log(response); // { response: 'Hello! How can I assist you today?', conversationId: '...', messageId: '...' }

response = await miniMaxClient.sendMessage('Write a short poem about cats.', { conversationId: response.conversationId, parentMessageId: response.messageId });
console.log(response.response);
console.log();

response = await miniMaxClient.sendMessage('Now write it in French.', {
    conversationId: response.conversationId,
    parentMessageId: response.messageId,
    // Streamed responses are supported.
    onProgress: token => process.stdout.write(token),
});
console.log();
console.log(response.response);
