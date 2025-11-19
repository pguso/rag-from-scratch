/**
 * Base configuration interface for LlamaCpp models
 */
export const DEFAULT_LLAMA_CONFIG = {
    contextSize: 2048,
    batchSize: 512,
    threads: 4,
};

/**
 * Create and load a Llama model
 */
export async function createLlamaModel(inputs, llama) {
    const { modelPath } = inputs;

    if (!modelPath) {
        throw new Error('modelPath is required');
    }

    return await llama.loadModel({
        modelPath,
        gpuLayers: inputs.gpuLayers,
        ...inputs.modelOptions,
    });
}

/**
 * Create a context from a loaded model
 */
export async function createLlamaContext(model, inputs) {
    return model.createContext({
        contextSize: inputs.contextSize ?? DEFAULT_LLAMA_CONFIG.contextSize,
        batchSize: inputs.batchSize ?? DEFAULT_LLAMA_CONFIG.batchSize,
        threads: inputs.threads ?? DEFAULT_LLAMA_CONFIG.threads,
        ...inputs.contextOptions,
    });
}

/**
 * Create a chat session from a context
 */
export async function createLlamaSession(context) {
    const { LlamaChatSession } = await import('node-llama-cpp');

    return new LlamaChatSession({
        contextSequence: context.getSequence(),
    });
}

/**
 * Create a grammar for constrained generation
 */
export async function createLlamaGrammar(gbnfString, llama) {
    if (!gbnfString) return undefined;

    return await llama.createGrammar({
        grammar: gbnfString,
    });
}

/**
 * Create a JSON schema grammar
 */
export async function createLlamaJsonSchemaGrammar(jsonSchema, llama) {
    if (!jsonSchema) return undefined;

    return await llama.createGrammarForJsonSchema({
        schema: jsonSchema,
    });
}