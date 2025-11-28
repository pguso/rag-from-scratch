# Building an LLM Wrapper - Code Walkthrough

A detailed explanation of how to build and use a wrapper class for Large Language Models, covering both the implementation (`LlamaCpp.js`) and usage examples (`example.js`).

## Overview

This example demonstrates:
- How to design an abstract base class (`BaseLLM`)
- How to implement a concrete wrapper (`LlamaCpp`)
- How to use the wrapper in real applications
- Best practices for LLM integration in RAG systems

---

## Part 1: The Implementation (LlamaCpp.js)

### Imports

```javascript
import {BaseLLM} from './BaseLLM.js';
import {createLlamaContext, createLlamaGrammar, createLlamaModel, createLlamaSession,} from '../utils/llama_cpp.js';
import {getLlama} from 'node-llama-cpp';
```

**What's imported:**
- **`BaseLLM`**: Abstract base class that defines the interface all LLMs must follow
- **Helper functions**: Utility functions that wrap node-llama-cpp initialization steps
- **`getLlama`**: Factory function from node-llama-cpp to get the Llama instance

**Why helpers?**
- Encapsulate complex initialization logic
- Reusable across different LLM wrappers
- Easier to test and maintain

---

### Class Definition and Constructor

```javascript
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
```

**What it does:**
1. **Extends BaseLLM**: Inherits common functionality and ensures consistent interface
2. **Stores configuration**: Saves generation parameters (temperature, tokens, etc.)
3. **Initializes private fields**: Sets placeholders for node-llama-cpp objects

**Key parameters explained:**
- **`maxTokens`**: Maximum number of tokens to generate (controls response length)
- **`temperature`**: Randomness in generation (0.0 = deterministic, 1.0+ = creative)
- **`topK`**: Limits sampling to top K most likely tokens
- **`topP`**: Nucleus sampling - considers tokens with cumulative probability up to P
- **`trimWhitespaceSuffix`**: Whether to remove trailing whitespace from responses

**Why private fields (`_model`, `_context`, etc.)?**
- Encapsulation: Users don't need to know about these internals
- Safety: Prevents accidental modification of critical objects
- Clarity: Underscore prefix signals "internal implementation detail"

**Why initialize to `null`?**
- Constructor can't be async in JavaScript
- Actual initialization happens in the static `initialize()` method
- This pattern ensures we never have a partially-initialized instance

---

### Static Factory Method

```javascript
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
```

**The Factory Pattern in action:**

**Problem:** JavaScript constructors can't be async, but model loading requires async operations.

**Solution:** Static factory method that:
1. Creates the instance (sync)
2. Performs async initialization
3. Returns fully-ready instance

**Step-by-step:**

**Step 1: Create instance**
```javascript
const instance = new LlamaCpp(inputs);
```
Creates the object with configuration stored but not yet initialized.

**Step 2: Get Llama instance**
```javascript
const llama = await getLlama();
```
Gets the core Llama instance that manages native binaries.

**Step 3: Load the model**
```javascript
instance._model = await createLlamaModel(inputs, llama);
```
Loads the GGUF model file into memory. This is the largest and slowest initialization step.

**Expected inputs:**
```javascript
{
    modelPath: "./models/llama-3.1-8b-q4_0.gguf",  // Required
    gpuLayers: 35,  // Optional - for GPU acceleration
}
```

**Step 4: Create context**
```javascript
instance._context = await createLlamaContext(instance._model, inputs);
```
Creates a context window (the model's "working memory").

**Expected inputs:**
```javascript
{
    contextSize: 2048,  // Optional - defaults to 2048 tokens
}
```

**Step 5: Create session**
```javascript
instance._session = await createLlamaSession(instance._context);
```
Creates a session that manages conversation state within the context.

**Step 6: Optional grammar loading**
```javascript
if (inputs.gbnf) {
    instance._grammar = await createLlamaGrammar(inputs.gbnf, llama);
}
```

**What is GBNF?**
- Grammar format that constrains model output
- Ensures output follows specific structure (e.g., JSON, lists)
- Useful for structured data extraction

**Example GBNF:**
```javascript
const gbnf = `
root ::= answer
answer ::= "yes" | "no"
`;
// Model can only output "yes" or "no"
```

**Why this pattern is better:**

❌ **Bad (manual initialization):**
```javascript
const model = new LlamaCpp({ modelPath: "..." });
await model.initialize();  // Easy to forget!
const response = await model.invoke("Hello");
```

✅ **Good (factory method):**
```javascript
const model = await LlamaCpp.initialize({ modelPath: "..." });
const response = await model.invoke("Hello");  // Always ready!
```

---

### The invoke() Method

```javascript
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
```

**What it does:** Generates a complete response for a given prompt.

**Step-by-step:**

**Step 1: Merge options**
```javascript
const promptOptions = {
    maxTokens: options.maxTokens ?? this.maxTokens,
    // ... other parameters
};
```

**The precedence:**
1. First check `options.maxTokens` (per-call override)
2. If not provided (`undefined`), use `this.maxTokens` (instance default)
3. The `??` operator is nullish coalescing (only falls back if left is `null` or `undefined`)

**Why this is flexible:**
```javascript
// Uses instance defaults
await model.invoke("Hello");

// Overrides maxTokens for this call only
await model.invoke("Write a story", { maxTokens: 500 });
```

**Step 2: Call the session**
```javascript
return await this._session.prompt(prompt, promptOptions);
```
Delegates to node-llama-cpp's session to do the actual generation.

**Step 3: Error handling**
```javascript
catch (error) {
    throw new Error(`LlamaCpp invoke failed: ${error.message}`);
}
```
Wraps low-level errors with context about which method failed.

**Return value:** String containing the complete generated response.

**Example usage:**
```javascript
const response = await model.invoke("What is 2+2?");
console.log(response);  // "4" or "2+2 equals 4" depending on model
```

---

### The stream() Method

```javascript
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
```

**What it does:** Returns an async generator that yields tokens as they're generated.

**The `async *` syntax:**
- `async`: This function returns a Promise
- `*`: This is a generator function
- `async *`: Async generator - yields values over time

**How it works:**

**Step 1: Collect chunks**
```javascript
const chunks = [];

await this.invoke(prompt, {
    ...options,
    onToken: (chunk) => {
        chunks.push(chunk);
    },
});
```

- Calls `invoke()` with a callback that collects each token
- The `onToken` callback is called by node-llama-cpp as each token is generated
- All chunks are stored in the array

**Step 2: Yield chunks**
```javascript
for (const chunk of chunks) {
    yield chunk;
}
```
Yields each chunk to the caller one at a time.

**Usage example:**
```javascript
for await (const token of model.stream("Count to 5")) {
    process.stdout.write(token);  // Prints tokens as they arrive
}
```

**Output:**
```
1
,

2
,

3
,

4
,

5
```
(Each token printed immediately as it's generated)

**Why this implementation?**

This is a simple implementation that:
- ✅ Reuses `invoke()` logic
- ✅ Works with node-llama-cpp's callback API
- ✅ Provides streaming interface to users

**More advanced implementation could:**
- Stream chunks in real-time (not buffering)
- Use async iteration directly
- Provide progress updates

---

### Helper Methods

#### getModelType()

```javascript
getModelType() {
    return 'llama_cpp';
}
```

**What it does:** Returns a string identifier for this LLM type.

**Why it's useful:**
```javascript
// Can identify which LLM you're using
console.log(model.getModelType());  // "llama_cpp"

// Useful for logging and debugging
function logQuery(model, query, response) {
    console.log(`[${model.getModelType()}] ${query} -> ${response}`);
}
```

#### dispose()

```javascript
async dispose() {
    if (this._context) {
        await this._context.dispose();
    }
}
```

**What it does:** Cleans up resources used by the model.

**Why it's critical:**
- LLMs use significant memory (GBs for larger models)
- Context holds tokenized data in memory
- Not disposing can cause memory leaks

**Best practice usage:**
```javascript
const model = await LlamaCpp.initialize({ modelPath: "..." });
try {
    const response = await model.invoke("Hello");
    console.log(response);
} finally {
    await model.dispose();  // Always clean up!
}
```

**What gets disposed:**
- Context: Frees the memory used for the context window
- (Model and session are tied to context, so they're cleaned up too)

---

## Part 2: Usage Examples (example.js)

### Setup and Imports

```javascript
import {LlamaCpp} from "../../../src/llms/index.js";
```

Imports the wrapper we built. Note the path goes up to `/src/llms/` where our implementation lives.

### Example 1: Basic Usage

```javascript
const model = await LlamaCpp.initialize({
    modelPath: process.env.MODEL_PATH || './models/llama-3.1-8b-q4_0.gguf',
    maxTokens: 100,
    temperature: 0.7,
});

const response1 = await model.invoke(
    'What are the three primary colors?'
);
console.log('Q: What are the three primary colors?');
console.log('A:', response1);
```

**What's happening:**

**Step 1: Initialize with configuration**
```javascript
modelPath: process.env.MODEL_PATH || './models/llama-3.1-8b-q4_0.gguf',
```
- Tries to use `MODEL_PATH` environment variable first
- Falls back to default path if not set
- Good practice: Makes code configurable without changing it

**Step 2: Set defaults**
```javascript
maxTokens: 100,
temperature: 0.7,
```
- `maxTokens: 100`: Relatively short responses (good for factual Q&A)
- `temperature: 0.7`: Moderate creativity (balanced)

**Step 3: Simple invocation**
```javascript
const response1 = await model.invoke('What are the three primary colors?');
```
Single method call - all complexity hidden!

**Expected output:**
```
Q: What are the three primary colors?
A: The three primary colors are red, blue, and yellow.
```

---

### Example 2: Streaming Tokens

```javascript
console.log('Q: Count from 1 to 5.');
console.log('A: ');

for await (const chunk of model.stream('Count from 1 to 5.')) {
    process.stdout.write(chunk);
}
```

**What's happening:**

**The `for await...of` syntax:**
```javascript
for await (const chunk of model.stream(...)) {
    // Process each chunk as it arrives
}
```
- Waits for each chunk from the async generator
- Processes tokens in real-time
- Perfect for UI updates

**Writing to stdout:**
```javascript
process.stdout.write(chunk);
```
- Uses `write()` instead of `console.log()` to avoid newlines
- Prints tokens continuously as they arrive
- Creates typewriter effect

**Expected output:**
```
Q: Count from 1 to 5.
A: 1, 2, 3, 4, 5
```
(But each number/comma appears gradually, not all at once)

**When to use streaming:**
- ✅ Chatbot interfaces (users see response forming)
- ✅ Long-form content generation (shows progress)
- ✅ Interactive applications (immediate feedback)
- ❌ Batch processing (overhead not worth it)
- ❌ API responses where you need complete text

---

### Example 3: Batch Processing

```javascript
const questions = [
    'What is 2+2?',
    'What color is the sky?',
    'What is the capital of France?',
];

console.log('Processing multiple questions...\n');
const responses = await model.batch(questions);

questions.forEach((q, i) => {
    console.log(`Q${i + 1}: ${q}`);
    console.log(`A${i + 1}: ${responses[i]}\n`);
});
```

**What's happening:**

**The batch() method:**
```javascript
const responses = await model.batch(questions);
```
- Inherited from `BaseLLM`
- Processes all questions and returns array of responses
- Same order as input

**Default implementation (in BaseLLM):**
```javascript
async batch(prompts) {
    return Promise.all(prompts.map(p => this.invoke(p)));
}
```
- Uses `Promise.all()` to run prompts concurrently
- Wait for all to complete
- Return array of results

**Output format:**
```
Processing multiple questions...

Q1: What is 2+2?
A1: 4

Q2: What color is the sky?
A2: Blue

Q3: What is the capital of France?
A3: Paris
```

**When to use batch():**
- ✅ Processing multiple documents
- ✅ Running evaluations/benchmarks
- ✅ Bulk Q&A tasks
- ⚠️ Be careful with very large batches (memory usage)

---

### Example 4: Custom Options Per Request

```javascript
const response2 = await model.invoke(
    'Write a creative story opening.',
    {
        maxTokens: 150,
        temperature: 0.9,  // More creative
    }
);

console.log('Q: Write a creative story opening.');
console.log('A:', response2);
```

**What's happening:**

**Overriding defaults:**
```javascript
{
    maxTokens: 150,      // Override: longer response (default was 100)
    temperature: 0.9,    // Override: more creative (default was 0.7)
}
```

**Why override per request:**
- Different tasks need different parameters
- Factual Q&A: Low temperature (0.1-0.5)
- Creative writing: High temperature (0.8-1.2)
- Short answers: Low maxTokens (50-100)
- Long form: High maxTokens (500+)

**Expected output:**
```
Q: Write a creative story opening.
A: The old lighthouse stood defiant against the storm, its beam cutting 
through the darkness like a knife through butter. Sarah had always been 
drawn to this place, though she couldn't quite explain why...
```
(More creative and longer than previous responses)

---

### Resource Cleanup

```javascript
await model.dispose();
```

**Critical final step:**
- Releases memory used by the model
- Prevents memory leaks
- Should always be in a `finally` block or at program end

**Better pattern:**
```javascript
const model = await LlamaCpp.initialize({ ... });
try {
    // Use model
} finally {
    await model.dispose();  // Always runs, even if errors occur
}
```

---

## Part 3: The BaseLLM Interface

While not shown in the files, `BaseLLM` would look something like:

```javascript
export class BaseLLM {
    constructor(inputs) {
        // Store common configuration
    }

    // Abstract method - must be implemented by subclasses
    async invoke(prompt, options = {}) {
        throw new Error('Subclass must implement invoke()');
    }

    // Abstract method - must be implemented by subclasses
    async *stream(prompt, options = {}) {
        throw new Error('Subclass must implement stream()');
    }

    // Concrete method - works for all subclasses
    async batch(prompts) {
        return Promise.all(prompts.map(p => this.invoke(p)));
    }

    // Abstract method - must be implemented by subclasses
    getModelType() {
        throw new Error('Subclass must implement getModelType()');
    }

    // Optional - subclasses can override if needed
    async dispose() {
        // Default: no-op
    }
}
```

**Key points:**

**Abstract methods:**
- Defined but throw errors
- Must be implemented by subclasses
- Ensures all LLMs have the same interface

**Concrete methods:**
- Implemented in base class
- Reused by all subclasses
- Can be overridden if needed

**Benefits:**
- ✅ Consistency: All LLMs work the same way
- ✅ Reusability: Common logic in one place
- ✅ Flexibility: Easy to add new LLM providers
- ✅ Type safety: IDE knows what methods exist

---

## Key Concepts Summary

### 1. Factory Pattern

**Problem:** Can't have async constructors in JavaScript

**Solution:** Static factory method
```javascript
static async initialize(inputs) {
    const instance = new ClassName(inputs);
    await instance.doAsyncSetup();
    return instance;
}
```

### 2. Template Method Pattern

**Pattern:** Base class defines structure, subclasses fill in details

```javascript
// Base class
class BaseLLM {
    async batch(prompts) {
        return Promise.all(prompts.map(p => this.invoke(p)));
    }
    // Uses this.invoke() which subclasses implement
}

// Subclass
class LlamaCpp extends BaseLLM {
    async invoke(prompt) {
        // Specific implementation
    }
}
```

### 3. Dependency Injection

**Pattern:** Pass dependencies rather than hard-coding them

```javascript
// Good: Flexible
async function processQuestions(questions, model) {
    return model.batch(questions);
}

// Can use any model:
processQuestions(questions, llamaModel);
processQuestions(questions, openaiModel);
```

### 4. Resource Management

**Pattern:** Always clean up resources

```javascript
const model = await LlamaCpp.initialize({ ... });
try {
    // Use model
} finally {
    await model.dispose();  // Guaranteed to run
}
```

---

## Configuration Options Reference

### Initialization Options

```javascript
await LlamaCpp.initialize({
    // Required
    modelPath: string,        // Path to GGUF model file
    
    // Optional - Model loading
    gpuLayers: number,        // Number of layers to offload to GPU
    
    // Optional - Context
    contextSize: number,      // Context window size (default: 2048)
    
    // Optional - Generation defaults
    maxTokens: number,        // Max tokens to generate
    temperature: number,      // Sampling temperature (0.0-2.0)
    topK: number,            // Top-K sampling
    topP: number,            // Top-P (nucleus) sampling
    trimWhitespaceSuffix: boolean,  // Trim trailing whitespace
    
    // Optional - Structured output
    gbnf: string,            // GBNF grammar string
});
```

### Invoke Options

```javascript
await model.invoke(prompt, {
    maxTokens: number,       // Override instance default
    onToken: (chunk) => {},  // Callback for each token (for streaming)
});
```

---

## Summary

### What We Built

1. **LlamaCpp wrapper class**
   - Extends BaseLLM for consistency
   - Uses factory pattern for initialization
   - Provides `invoke()`, `stream()`, and `batch()`
   - Handles resource cleanup

2. **Usage examples**
   - Basic invocation
   - Streaming tokens
   - Batch processing
   - Custom options

### Key Takeaways

- ✅ Wrappers simplify complex libraries
- ✅ Factory pattern solves async constructor problem
- ✅ Abstract base class ensures consistency
- ✅ Resource management prevents memory leaks
- ✅ Configuration objects are flexible and clear

### Next Steps

With this wrapper in place, you can:
- Build RAG pipelines
- Switch LLM providers easily
- Test your code effectively

The wrapper is your foundation for all LLM operations in your application.
