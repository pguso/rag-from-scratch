# Building an LLM Wrapper - Conceptual Overview

## What is an LLM Wrapper?

An **LLM wrapper** is a class that provides a simplified, consistent interface for interacting with Large Language Models.

Think of it as a **translator and organizer** between your application and the complex underlying LLM library.

### The Problem It Solves

**Without a wrapper:**
```javascript
// Direct use of node-llama-cpp - verbose and repetitive
const llama = await getLlama();
const model = await llama.loadModel({ modelPath: "..." });
const context = await model.createContext({ contextSize: 2048 });
const session = new LlamaChatSession({ contextSequence: context.getSequence() });
const response = await session.prompt("Hello", { temperature: 0.7 });
// ... repeat this setup everywhere you need the model
```

**With a wrapper:**
```javascript
// Clean, simple interface
const model = await LlamaCpp.initialize({ modelPath: "..." });
const response = await model.invoke("Hello");
```

---

## Why Build a Wrapper?

### 1. **Simplification**

**Before:** You need to understand and manage multiple node-llama-cpp concepts:
- Llama instance
- Model loading
- Context creation
- Session management
- Grammar parsing

**After:** One class handles all the complexity:
```javascript
const model = await LlamaCpp.initialize({ modelPath: "..." });
// Everything is ready to use!
```

### 2. **Consistency**

If you're building a RAG system, you'll use the LLM in many places:
- Document summarization
- Question answering
- Reranking results
- Query expansion

Without a wrapper, each place repeats the same initialization code. With a wrapper, you have **one consistent interface** everywhere.

### 3. **Flexibility**

Today you might use `node-llama-cpp` (local model). Tomorrow you might want to:
- Switch to OpenAI's API
- Use Claude from Anthropic
- Try a different local model library

**With a good wrapper design:**
```javascript
// All implementations share the same interface
const model1 = await LlamaCpp.initialize({ ... });
const model2 = await OpenAI.initialize({ apiKey: "..." });
const model3 = await Claude.initialize({ apiKey: "..." });

// They all work the same way:
await model1.invoke("Hello");
await model2.invoke("Hello");
await model3.invoke("Hello");
```

Change one line of code to switch providers entirely!

### 4. **Testability**

**Without a wrapper:**
```javascript
// Hard to test - tightly coupled to node-llama-cpp
async function answerQuestion(question) {
    const llama = await getLlama();
    const model = await llama.loadModel({ ... });
    // ... lots of setup
    return await session.prompt(question);
}
```

**With a wrapper:**
```javascript
// Easy to test - can mock the wrapper
async function answerQuestion(question, model) {
    return await model.invoke(question);
}

// In tests, use a mock:
const mockModel = { invoke: async (q) => "test response" };
```

---

## Key Design Patterns

### Pattern 1: Abstract Base Class

```javascript
class BaseLLM {
    async invoke(prompt, options) {
        throw new Error("Must implement invoke()");
    }
    
    async batch(prompts) {
        // Default implementation works for all subclasses
        return Promise.all(prompts.map(p => this.invoke(p)));
    }
}
```

**What it does:**
- Defines the interface all LLMs must implement
- Provides common functionality (like `batch()`)
- Ensures consistency across different LLM implementations

**Benefits:**
- Any code that works with one LLM works with all of them
- Add new LLM providers without changing existing code
- Type checking and IDE autocomplete

### Pattern 2: Factory Method

```javascript
// Instead of:
const model = new LlamaCpp({ modelPath: "..." });
await model.initialize();  // Easy to forget!

// Use:
const model = await LlamaCpp.initialize({ modelPath: "..." });
// Already initialized and ready to use
```

**What it does:**
- Handles async initialization in the constructor
- Returns a fully-ready instance
- Prevents using uninitialized objects

**Why it matters:**
- JavaScript constructors can't be async
- Model loading requires async operations
- Factory method ensures proper initialization

### Pattern 3: Configuration Objects

```javascript
const model = await LlamaCpp.initialize({
    modelPath: "./model.gguf",
    contextSize: 2048,
    maxTokens: 500,
    temperature: 0.7,
    topK: 40,
    topP: 0.9,
});
```

**Benefits:**
- Named parameters (clear what each value means)
- Optional parameters with sensible defaults
- Easy to add new options without breaking existing code
- Self-documenting

### Pattern 4: Resource Management

```javascript
const model = await LlamaCpp.initialize({ ... });
try {
    // Use the model
    const response = await model.invoke("Hello");
} finally {
    // Always clean up resources
    await model.dispose();
}
```

**Why it's important:**
- LLMs use significant memory
- Proper cleanup prevents memory leaks
- Releases GPU resources if used
- Follows best practices for resource management

---

## The Architecture

### Component Overview

```
┌─────────────────────────────────────────────┐
│           Your Application                  │
│  (RAG pipeline, chatbot, etc.)             │
└─────────────────┬───────────────────────────┘
                  │
                  │ Simple API
                  │
┌─────────────────▼───────────────────────────┐
│            BaseLLM                          │
│  (Abstract interface)                       │
│  - invoke(prompt)                           │
│  - stream(prompt)                           │
│  - batch(prompts)                           │
└─────────────────┬───────────────────────────┘
                  │
                  │ Implements
                  │
┌─────────────────▼───────────────────────────┐
│           LlamaCpp                          │
│  (Concrete implementation)                  │
│  - Manages model loading                    │
│  - Handles context/sessions                 │
│  - Provides invoke/stream                   │
└─────────────────┬───────────────────────────┘
                  │
                  │ Uses
                  │
┌─────────────────▼───────────────────────────┐
│         node-llama-cpp                      │
│  (External library)                         │
│  - Low-level LLM operations                 │
└─────────────────────────────────────────────┘
```

### How It Works

1. **Your code** calls the simple wrapper API
2. **LlamaCpp wrapper** translates to node-llama-cpp
3. **node-llama-cpp** handles the actual LLM operations
4. **Results** flow back up through the layers

Each layer adds value:
- **BaseLLM**: Provides consistency and common features
- **LlamaCpp**: Handles node-llama-cpp specifics
- **Your code**: Focuses on your application logic

---

## Real-World Benefits

### Before: Scattered Complexity

**In retrieval.js:**
```javascript
const llama = await getLlama();
const model = await llama.loadModel({ modelPath: "..." });
// ... setup code ...
```

**In summarization.js:**
```javascript
const llama = await getLlama();
const model = await llama.loadModel({ modelPath: "..." });
// ... same setup code repeated ...
```

**In generation.js:**
```javascript
const llama = await getLlama();
const model = await llama.loadModel({ modelPath: "..." });
// ... same setup code again ...
```

**Problems:**
- Code duplication
- Easy to make mistakes
- Hard to change configuration
- Difficult to test

### After: Centralized Wrapper

**In all files:**
```javascript
import { LlamaCpp } from './llms/LlamaCpp.js';

const model = await LlamaCpp.initialize({ modelPath: "..." });
const response = await model.invoke(prompt);
```

**Benefits:**
- ✅ Write the complex code once
- ✅ Use simple API everywhere
- ✅ Change configuration in one place
- ✅ Easy to test and mock

---

## Wrapper Features Demonstrated

### 1. Basic Invocation

```javascript
const response = await model.invoke("What are the primary colors?");
```

**What it does:** Sends a prompt and waits for the complete response.

**When to use:** Simple Q&A, one-shot completions, batch processing.

### 2. Streaming

```javascript
for await (const chunk of model.stream("Count from 1 to 5")) {
    process.stdout.write(chunk);
}
```

**What it does:** Yields tokens as they're generated.

**When to use:** 
- Real-time UI updates
- Long responses where user wants to see progress
- Chatbot interfaces

### 3. Batch Processing

```javascript
const questions = ["Q1?", "Q2?", "Q3?"];
const answers = await model.batch(questions);
```

**What it does:** Processes multiple prompts efficiently.

**When to use:**
- Processing multiple documents
- Evaluating the model on test sets
- Bulk operations

### 4. Custom Options

```javascript
await model.invoke("Write a story", {
    maxTokens: 500,      // Longer response
    temperature: 0.9,    // More creative
});
```

**What it does:** Override default settings per invocation.

**When to use:** Different tasks need different parameters.

---

## Common Questions

### Q: Why not just use node-llama-cpp directly?

**Answer:** You can! But a wrapper provides:
- Simpler API
- Better reusability
- Easier testing
- Future flexibility

For a one-off script, direct usage is fine. For a larger application (like a RAG system), the wrapper saves time and reduces errors.

### Q: Does the wrapper add overhead?

**Answer:** Minimal. The wrapper is a thin layer that:
- Doesn't process the text itself
- Just organizes the API calls
- Adds negligible latency (<1ms)

The actual LLM inference time (100ms-10s) dominates any wrapper overhead.

### Q: Can I add custom methods to the wrapper?

**Absolutely!** Common additions:
```javascript
class LlamaCpp extends BaseLLM {
    // Your custom method
    async summarize(text) {
        return this.invoke(`Summarize: ${text}`, { maxTokens: 100 });
    }
    
    // Another helper
    async answerWithContext(question, context) {
        const prompt = `Context: ${context}\n\nQuestion: ${question}`;
        return this.invoke(prompt);
    }
}
```

### Q: How do I switch to a different LLM provider?

**Step 1:** Create a new wrapper implementing `BaseLLM`:
```javascript
class OpenAI extends BaseLLM {
    static async initialize(inputs) {
        // Initialize OpenAI API
    }
    
    async invoke(prompt, options) {
        // Call OpenAI API
    }
}
```

**Step 2:** Change one line in your code:
```javascript
// Before:
const model = await LlamaCpp.initialize({ ... });

// After:
const model = await OpenAI.initialize({ ... });
```

Everything else works the same!

---

## Design Principles

### 1. **Separation of Concerns**

- **BaseLLM**: Defines what all LLMs can do
- **LlamaCpp**: Knows how to use node-llama-cpp
- **Your application**: Focuses on business logic

Each class has one job and does it well.

### 2. **Don't Repeat Yourself (DRY)**

Common functionality lives in one place:
- `batch()` in BaseLLM works for all implementations
- Configuration parsing in one place
- Error handling centralized

### 3. **Open/Closed Principle**

- **Open for extension:** Easy to add new LLM providers
- **Closed for modification:** Existing code doesn't change

Add new implementations without breaking old ones.

### 4. **Interface Segregation**

The wrapper exposes only what you need:
- `invoke()` for basic use
- `stream()` for streaming
- `batch()` for multiple prompts
- `dispose()` for cleanup

Internal complexity (model, context, session) is hidden.

---

## Practical Example: RAG System

### Without Wrapper

```javascript
// Retrieval component
const llama1 = await getLlama();
const model1 = await llama1.loadModel({ ... });
const context1 = await model1.createContext({ ... });
const session1 = new LlamaChatSession({ ... });

// Generation component  
const llama2 = await getLlama();
const model2 = await llama2.loadModel({ ... });
const context2 = await model2.createContext({ ... });
const session2 = new LlamaChatSession({ ... });

// Lots of duplicated setup!
```

### With Wrapper

```javascript
// Retrieval component
const model = await LlamaCpp.initialize({ modelPath: "..." });

// Generation component (reuses the same model)
const answer = await model.invoke(query + retrievedContext);

// Clean, simple, maintainable!
```

---

## Summary

**An LLM wrapper is essential for:**
- Building maintainable RAG systems
- Supporting multiple LLM providers
- Writing testable code
- Keeping your application code clean

**Key concepts:**
1. **Abstraction:** Hide complexity behind a simple interface
2. **Factory pattern:** Ensure proper async initialization
3. **Base class:** Define consistent API across implementations
4. **Resource management:** Clean up properly

**This example demonstrates:**
- ✅ How to design a wrapper class
- ✅ Why it's better than using libraries directly
- ✅ How to support streaming and batching
- ✅ How to make your code flexible and maintainable

**Next in RAG pipeline:**
- Data loading and document processing
- Text chunking strategies
- Embeddings for semantic search
- Building the complete RAG system

The wrapper you build now will be used throughout your entire RAG implementation, making this foundation critical for success.
