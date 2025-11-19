import {BaseLLM} from './BaseLLM.js';
import {createLlamaContext, createLlamaGrammar, createLlamaModel, createLlamaSession,} from '../utils/llama_cpp.js';
import {getLlama} from 'node-llama-cpp';

/**
 * LlamaCpp language model implementation
 */
export class LlamaCpp extends BaseLLM {
    constructor(inputs) {
        super(inputs);
        this.maxTokens = inputs?.maxTokens;
        this.temperature = inputs?.temperature;
        this.topK = inputs?.topK;
        this.topP = inputs?.topP;
        this.trimWhitespaceSuffix = inputs?.trimWhitespaceSuffix;

        // Private instances (initialized in initialize())
        this._model = null;
        this._context = null;
        this._session = null;
        this._grammar = null;
    }

    /**
     * Static factory method to initialize the model
     * @param {Object} inputs - Configuration inputs
     * @param {string} inputs.modelPath - Path to GGUF model file
     * @param {number} [inputs.contextSize=2048] - Context window size
     * @param {number} [inputs.maxTokens] - Max tokens to generate
     * @param {number} [inputs.temperature] - Sampling temperature
     * @param {number} [inputs.topK] - Top-K sampling
     * @param {number} [inputs.topP] - Top-P sampling
     * @param {string} [inputs.gbnf] - GBNF grammar string
     * @returns {Promise<LlamaCpp>} Initialized LlamaCpp instance
     */
    static async initialize(inputs) {
        const instance = new LlamaCpp(inputs);
        const llama = await getLlama();

        // Create model, context, and session using helper functions
        instance._model = await createLlamaModel(inputs, llama);
        instance._context = await createLlamaContext(instance._model, inputs);
        instance._session = await createLlamaSession(instance._context);

        // Optional: Load grammar
        if (inputs.gbnf) {
            instance._grammar = await createLlamaGrammar(inputs.gbnf, llama);
        }

        return instance;
    }

    /**
     * Generate completion for a prompt
     */
    async invoke(prompt, options = {}) {
        try {
            const promptOptions = {
                maxTokens: options.maxTokens ?? this.maxTokens,
                temperature: this.temperature,
                topK: this.topK,
                topP: this.topP,
                trimWhitespaceSuffix: this.trimWhitespaceSuffix,
                grammar: this._grammar,
                onToken: options.onToken,
            };

            return await this._session.prompt(prompt, promptOptions);
        } catch (error) {
            throw new Error(`LlamaCpp invoke failed: ${error.message}`);
        }
    }

    /**
     * Stream tokens as they're generated
     */
    async *stream(prompt, options = {}) {
        const chunks = [];

        await this.invoke(prompt, {
            ...options,
            onToken: (chunk) => {
                chunks.push(chunk);
            },
        });

        for (const chunk of chunks) {
            yield chunk;
        }
    }

    /**
     * Get model type identifier
     */
    getModelType() {
        return 'llama_cpp';
    }

    /**
     * Clean up resources
     */
    async dispose() {
        if (this._context) {
            await this._context.dispose();
        }
    }
}