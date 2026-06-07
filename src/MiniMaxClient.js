import ChatGPTClient from './ChatGPTClient.js';

const MINIMAX_DEFAULT_MODEL = 'MiniMax-M3';

export default class MiniMaxClient extends ChatGPTClient {
    constructor(
        apiKey,
        options = {},
        cacheOptions = {},
    ) {
        // Set MiniMax-specific defaults before calling super
        const miniMaxOptions = {
            ...options,
            modelOptions: {
                model: MINIMAX_DEFAULT_MODEL,
                ...options.modelOptions,
            },
        };
        super(apiKey, miniMaxOptions, cacheOptions);
    }

    setOptions(options) {
        if (this.options && !this.options.replaceOptions) {
            this.options.modelOptions = {
                ...this.options.modelOptions,
                ...options.modelOptions,
            };
            delete options.modelOptions;
            this.options = {
                ...this.options,
                ...options,
            };
        } else {
            this.options = options;
        }

        if (this.options.minimaxApiKey) {
            this.apiKey = this.options.minimaxApiKey;
        }

        const modelOptions = this.options.modelOptions || {};
        // Clamp temperature to MiniMax's accepted range [0, 1]
        let temperature = typeof modelOptions.temperature === 'undefined' ? 0.8 : modelOptions.temperature;
        temperature = Math.max(0, Math.min(1, temperature));

        this.modelOptions = {
            ...modelOptions,
            model: modelOptions.model || MINIMAX_DEFAULT_MODEL,
            temperature,
            top_p: typeof modelOptions.top_p === 'undefined' ? 1 : modelOptions.top_p,
            presence_penalty: typeof modelOptions.presence_penalty === 'undefined' ? 0 : modelOptions.presence_penalty,
            stop: modelOptions.stop,
        };

        // MiniMax models use the Chat Completions API (OpenAI-compatible)
        this.isChatGptModel = true;
        this.isUnofficialChatGptModel = false;

        this.maxContextTokens = this.options.maxContextTokens || 512000;
        this.maxResponseTokens = this.modelOptions.max_tokens || 4096;
        this.maxPromptTokens = this.options.maxPromptTokens || (this.maxContextTokens - this.maxResponseTokens);

        if (this.maxPromptTokens + this.maxResponseTokens > this.maxContextTokens) {
            throw new Error(`maxPromptTokens + max_tokens (${this.maxPromptTokens} + ${this.maxResponseTokens} = ${this.maxPromptTokens + this.maxResponseTokens}) must be less than or equal to maxContextTokens (${this.maxContextTokens})`);
        }

        this.userLabel = this.options.userLabel || 'User';
        this.chatGptLabel = this.options.chatGptLabel || 'MiniMax';

        this.startToken = '||>';
        this.endToken = '';
        this.gptEncoder = this.constructor.getTokenizer('cl100k_base');

        if (!this.modelOptions.stop) {
            const stopTokens = [this.startToken];
            if (this.endToken && this.endToken !== this.startToken) {
                stopTokens.push(this.endToken);
            }
            stopTokens.push(`\n${this.userLabel}:`);
            stopTokens.push('<|diff_marker|>');
            this.modelOptions.stop = stopTokens;
        }

        if (this.options.reverseProxyUrl) {
            this.completionsUrl = this.options.reverseProxyUrl;
        } else {
            this.completionsUrl = 'https://api.minimax.io/v1/chat/completions';
        }

        return this;
    }

    /**
     * Override buildPrompt to construct proper user/assistant role messages
     * for MiniMax's OpenAI-compatible Chat Completions API.
     */
    async buildPrompt(messages, parentMessageId, { promptPrefix = null } = {}) {
        const orderedMessages = this.constructor.getMessagesForConversation(messages, parentMessageId);

        promptPrefix = (promptPrefix || this.options.promptPrefix || '').trim();
        if (!promptPrefix) {
            const currentDateString = new Date().toLocaleDateString(
                'en-us',
                { year: 'numeric', month: 'long', day: 'numeric' },
            );
            promptPrefix = `You are ${this.chatGptLabel}, a large language model powered by MiniMax. Respond conversationally.\nCurrent date: ${currentDateString}`;
        }

        const systemMessage = {
            role: 'system',
            content: promptPrefix,
        };

        let currentTokenCount = this.getTokenCount(promptPrefix) + 4; // 4 for metadata
        const maxTokenCount = this.maxPromptTokens;

        const chatMessages = [];
        const context = [];

        // Iterate backwards through the messages, adding them to the prompt
        const buildMessages = async () => {
            if (currentTokenCount < maxTokenCount && orderedMessages.length > 0) {
                const message = orderedMessages.pop();
                const role = message.role === 'User' ? 'user' : 'assistant';
                const messageString = message.message;
                const tokenCountForMessage = this.getTokenCount(messageString) + 4;
                const newTokenCount = currentTokenCount + tokenCountForMessage;

                if (newTokenCount > maxTokenCount) {
                    if (chatMessages.length > 0) {
                        return false;
                    }
                    throw new Error(`Prompt is too long. Max token count is ${maxTokenCount}, but prompt is ${newTokenCount} tokens long.`);
                }

                chatMessages.unshift({ role, content: messageString });
                context.unshift(message);
                currentTokenCount = newTokenCount;
                await new Promise(resolve => setImmediate(resolve));
                return buildMessages();
            }
            return true;
        };

        await buildMessages();

        this.modelOptions.max_tokens = Math.min(
            this.maxContextTokens - currentTokenCount,
            this.maxResponseTokens,
        );

        const prompt = [systemMessage, ...chatMessages];
        return { prompt, context };
    }

    async generateTitle(userMessage, botMessage) {
        const messages = [
            {
                role: 'system',
                content: 'Write an extremely concise subtitle for this conversation with no more than a few words. All words should be capitalized. Exclude punctuation.',
            },
            {
                role: 'user',
                content: userMessage.message,
            },
            {
                role: 'assistant',
                content: botMessage.message,
            },
            {
                role: 'user',
                content: 'Now write a concise title for this conversation.',
            },
        ];

        const titleGenClientOptions = JSON.parse(JSON.stringify(this.options));
        titleGenClientOptions.modelOptions = {
            model: MINIMAX_DEFAULT_MODEL,
            temperature: 0,
            presence_penalty: 0,
            frequency_penalty: 0,
        };
        const titleGenClient = new MiniMaxClient(this.apiKey, titleGenClientOptions);
        const result = await titleGenClient.getCompletion(messages, null);
        return result.choices[0].message.content
            .replace(/[^a-zA-Z0-9' ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
