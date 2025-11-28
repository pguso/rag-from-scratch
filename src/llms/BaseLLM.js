/**
 * Abstract base class for all LLM implementations
 */
export class BaseLLM {
    constructor(config = {}) {
        if (this.constructor === BaseLLM) {
            throw new Error("BaseLLM is abstract and cannot be instantiated directly");
        }
        this.config = config;
    }

    /**
     * Generate completion - must be implemented by subclasses
     */
    async invoke(prompt, options) {
        throw new Error("invoke() must be implemented by subclass");
    }

    /**
     * Stream completion tokens
     */
    async *stream(prompt, options) {
        throw new Error("stream() must be implemented by subclass");
    }

    /**
     * Batch process multiple prompts
     */
    async batch(prompts, options) {
        return Promise.all(prompts.map(p => this.invoke(p)));
    }

    /**
     * Get the model type identifier
     */
    getModelType() {
        throw new Error("getModelType() must be implemented by subclass");
    }

    // Optional - subclasses can override if needed
    async dispose() {
        // Default: no-op
    }
}