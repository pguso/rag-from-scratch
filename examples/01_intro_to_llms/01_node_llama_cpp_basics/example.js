/**
 * NODE-LLAMA-CPP BASICS
 *
 * Learn how to use node-llama-cpp directly before building a wrapper.
 * This example shows the fundamental operations.
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import {fileURLToPath} from "url";

console.log('🦙 node-llama-cpp Basics\n');

// STEP 1: Get the Llama instance
console.log('Step 1: Getting Llama instance...');
const llama = await getLlama();
console.log('✓ Llama instance ready\n');

// STEP 2: Load a model
console.log('Step 2: Loading model...');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(__dirname, "..", "..", "..", "models", "hf_Qwen_Qwen3-1.7B.Q8_0.gguf");

const model = await llama.loadModel({
    modelPath,
    // gpuLayers: 35, // Uncomment to use GPU acceleration
});
console.log('✓ Model loaded\n');

// STEP 3: Create a context
console.log('Step 3: Creating context...');
const context = await model.createContext({
    contextSize: 2048,  // How many tokens to remember
    batchSize: 512,     // Batch size for processing
    threads: 4,         // CPU threads to use
});
console.log('✓ Context created\n');

// STEP 4: Create a chat session
console.log('Step 4: Creating chat session...');
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});
console.log('✓ Chat session ready\n');

// STEP 5: Generate a response
console.log('Step 5: Generating response...');
console.log('Prompt: "Explain what a Large Language Model is in one sentence."\n');

const response = await session.prompt(
    "Explain what a Large Language Model is in one sentence.",
    {
        temperature: 0.7,
    }
);

console.log('Response:', response);
console.log('\n✓ Generation complete\n');

// STEP 6: Streaming example
console.log('Step 6: Streaming example...');
console.log('Prompt: "Count from 1 to 5."\n');
console.log('Streaming tokens: ');

const tokens = [];
await session.prompt(
    "Count from 1 to 5.",
    {
        maxTokens: 50,
        onResponseChunk: (token) => {
            // Each token is generated one at a time
            tokens.push(token.text);
            process.stdout.write(token.text);
        }
    }
);

console.log('\n\nFull response:\n', tokens.join(''));
console.log('\n✓ Streaming complete\n');

// STEP 7: Cleanup
console.log('Step 7: Cleaning up resources...');
await context.dispose();
console.log('✓ Resources cleaned up\n');