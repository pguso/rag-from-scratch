# Code Walkthrough: node-llama-cpp Basics

This document provides a detailed walkthrough of the basic usage of node-llama-cpp, explaining each step of initializing and interacting with a local language model.

## Overview

This example demonstrates the fundamental workflow for running a Large Language Model locally using node-llama-cpp. It covers initialization, model loading, context creation, and both standard and streaming text generation.

## Imports and Setup

```javascript
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import {fileURLToPath} from "url";
```

- **`getLlama`**: Factory function that returns a Llama instance for managing models
- **`LlamaChatSession`**: Class for managing conversational interactions with the model
- **`path` and `fileURLToPath`**: Standard Node.js utilities for handling file paths in ES modules

## Step 1: Getting the Llama Instance

```javascript
const llama = await getLlama();
```

**What it does:** Initializes the core Llama instance that manages the underlying llama.cpp binaries.

**Why it's needed:** This instance is required to load models and manage the low-level operations. It handles the bridge between JavaScript and the native llama.cpp implementation.

**Note:** This is an async operation as it may need to initialize native binaries.

## Step 2: Loading the Model

```javascript
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(__dirname, "..", "..", "..", "models", "hf_Qwen_Qwen3-1.7B.Q8_0.gguf");

const model = await llama.loadModel({
    modelPath,
    // gpuLayers: 35, // Uncomment to use GPU acceleration
});
```

**What it does:** Loads a GGUF format model file into memory.

**Key details:**
- **Model path:** Points to a Qwen 3 1.7B model quantized to Q8_0 (8-bit quantization)
- **GGUF format:** The standard format used by llama.cpp for storing model weights
- **GPU layers:** Optional parameter to offload model layers to GPU for faster inference

**Performance consideration:** Model loading can take several seconds depending on model size. The 1.7B parameter model is relatively small and fast to load.

## Step 3: Creating a Context

```javascript
const context = await model.createContext({
    contextSize: 2048,  // How many tokens to remember
    batchSize: 512,     // Batch size for processing
    threads: 4,         // CPU threads to use
});
```

**What it does:** Creates a context window for the model to work within.

**Parameters explained:**
- **`contextSize: 2048`**: Maximum number of tokens the model can remember at once. This is the "working memory" of the model. Larger values allow longer conversations but use more RAM.
- **`batchSize: 512`**: Number of tokens to process in parallel. Larger batches are faster but use more memory.
- **`threads: 4`**: Number of CPU threads to use for inference. More threads generally mean faster processing (up to your CPU's limits).

**Memory usage:** Context size directly affects memory usage. A 2048 token context is moderate and suitable for most conversations.

## Step 4: Creating a Chat Session

```javascript
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});
```

**What it does:** Creates a stateful chat session that maintains conversation history.

**Why use a session:**
- Automatically manages conversation history
- Keeps track of context usage
- Handles the back-and-forth of multi-turn conversations
- Simplifies the API compared to raw model inference

**The sequence:** `context.getSequence()` gets a sequence object that manages the state of the conversation within the context window.

## Step 5: Standard Text Generation

```javascript
const response = await session.prompt(
    "Explain what a Large Language Model is in one sentence.",
    {
        temperature: 0.7,
    }
);

console.log('Response:', response);
```

**What it does:** Sends a prompt to the model and waits for the complete response.

**Parameters:**
- **First argument:** The prompt string
- **`temperature: 0.7`**: Controls randomness in generation
    - Lower values (0.1-0.5): More deterministic, focused responses
    - Medium values (0.6-0.8): Balanced creativity and coherence
    - Higher values (0.9-1.2): More creative but potentially less coherent

**Return value:** A string containing the model's complete response.

**Use case:** Best for when you want the full response at once, like for Q&A or when response time isn't critical.

## Step 6: Streaming Text Generation

```javascript
const tokens = [];
await session.prompt(
    "Count from 1 to 5.",
    {
        maxTokens: 50,
        onResponseChunk: (token) => {
            tokens.push(token.text);
            process.stdout.write(token.text);
        }
    }
);
```

**What it does:** Generates text token-by-token as the model produces it.

**Parameters:**
- **`maxTokens: 50`**: Maximum number of tokens to generate. Prevents runaway generation.
- **`onResponseChunk`**: Callback function that receives each token as it's generated
    - **`token.text`**: The actual text of the token (could be a word, part of a word, or punctuation)

**Why streaming matters:**
- Provides immediate feedback to users (like ChatGPT's typing effect)
- Allows for processing tokens as they arrive
- Better user experience for long responses
- Can cancel generation mid-stream if needed

**Token vs. Word:** A token isn't always a complete word. It could be:
- A whole word: "hello"
- Part of a word: "un" + "usual"
- Punctuation: "!"
- A space

## Step 7: Resource Cleanup

```javascript
await context.dispose();
```

**What it does:** Releases the memory and resources held by the context.

**Why it's important:**
- LLM contexts can use significant memory (several GB for large models)
- Prevents memory leaks in long-running applications
- Good practice even though Node.js has garbage collection

**What gets cleaned up:**
- Context memory
- Model state
- Associated buffers

## Key Concepts Summary

### The Three-Layer Architecture

1. **Llama Instance** → Manages binaries and model loading
2. **Model + Context** → Loaded weights and working memory
3. **Chat Session** → Conversational interface with history

### Memory Hierarchy

```
Llama Instance (minimal memory)
    ↓
Model (several GB - the weights)
    ↓
Context (configurable - working memory)
    ↓
Session (tracks conversation state)
```

### Async Operations

Every major operation is async because:
- Model loading reads large files from disk
- Inference involves computationally intensive operations
- Context creation allocates significant memory

## Common Patterns

### Basic Q&A
```javascript
const answer = await session.prompt("Your question here");
```

### Streaming Response
```javascript
await session.prompt("Your question", {
    onResponseChunk: (token) => console.log(token.text)
});
```

### Controlled Generation
```javascript
const response = await session.prompt("Question", {
    temperature: 0.3,      // More focused
    maxTokens: 100,        // Limit length
    topP: 0.9,             // Nucleus sampling
});
```

## Performance Tips

1. **GPU Acceleration:** Uncomment `gpuLayers` and set to the number of layers your GPU can handle
2. **Context Size:** Use the smallest context that works for your use case
3. **Batch Size:** Larger batches are faster but use more memory
4. **Threads:** Set to your CPU core count (or slightly less)
5. **Model Size:** Smaller quantized models (Q4, Q5) are faster but slightly less accurate

## Error Handling

This example doesn't include error handling, but in production you should wrap operations in try-catch blocks:

```javascript
try {
    const model = await llama.loadModel({ modelPath });
} catch (error) {
    console.error('Failed to load model:', error);
}
```