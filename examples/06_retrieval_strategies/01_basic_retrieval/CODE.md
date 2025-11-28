# Basic Retrieval Strategy - Code Walkthrough

A detailed explanation of implementing the foundational RAG retrieval strategy, combining vector search with LLM generation.

## Overview

This example demonstrates:
- Complete RAG pipeline implementation
- Top-k retrieval from vector store
- Context assembly and formatting
- LLM-based answer generation
- Handling edge cases (no results, low quality)
- Performance considerations
- Comparing with/without RAG

**Models Used:**
- **Embedding**: `bge-small-en-v1.5.Q8_0.gguf` (384 dimensions)
- **LLM**: `hf_Qwen_Qwen3-1.7B.Q8_0.gguf` (1.7B parameters)

---

## Setup and Configuration

### Imports

```javascript
import { fileURLToPath } from "url";
import path from "path";
import { VectorDB } from "embedded-vector-db";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { Document } from "../../../src/index.js";
import { OutputHelper } from "../../../helpers/output-helper.js";
import chalk from "chalk";
```

**Key imports:**
- `VectorDB`: In-memory vector database with HNSW
- `getLlama, LlamaChatSession`: LLM inference
- `Document`: Document abstraction with content + metadata
- `OutputHelper`: Formatting and spinner utilities
- `chalk`: Terminal colors for better output

### Configuration

```javascript
const EMBEDDING_MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");
const LLM_MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "hf_Qwen_Qwen3-1.7B.Q8_0.gguf");

const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "basic_retrieval";
```

**Configuration details:**
- `DIM = 384`: BGE-small embedding dimension
- `MAX_ELEMENTS`: Vector DB capacity
- `NS`: Namespace for isolation

---

## Core Functions

### 1. Initialize Embedding Model

```javascript
async function initializeEmbeddingModel() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: EMBEDDING_MODEL_PATH });
    return await model.createEmbeddingContext();
}
```

**What it does:**
- Loads BGE-small-en-v1.5 embedding model
- Creates embedding context for generating vectors
- Returns context used for both documents and queries

**Why separate from LLM:**
- Embedding models are different from generative LLMs
- Can use different models for embeddings vs generation
- Embedding context is reusable

**Performance:**
- Load time: ~2-5 seconds
- Embedding generation: ~45ms per text

### 2. Initialize LLM

```javascript
async function initializeLLM() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: LLM_MODEL_PATH });
    const context = await model.createContext();
    return new LlamaChatSession({ contextSequence: context.getSequence() });
}
```

**What it does:**
- Loads Qwen3 1.7B model
- Creates context for inference
- Returns chat session for conversation-style interactions

**LlamaChatSession benefits:**
- Maintains conversation history
- Handles prompt formatting automatically
- Manages context window

**Performance:**
- Load time: ~5-10 seconds (1.7B model)
- Generation: ~300-500ms for typical answer

### 3. Create Knowledge Base

```javascript
function createKnowledgeBase() {
    return [
        new Document("Python is a high-level programming language...", {
            id: "doc_1",
            category: "programming",
            topic: "python",
        }),
        // ... more documents
    ];
}
```

**What it does:**
- Creates sample documents for demonstration
- Each document has content + metadata
- Covers various topics for diverse queries

**Document structure:**
```javascript
{
    pageContent: "...",  // Main text content
    metadata: {
        id: "doc_1",           // Unique identifier
        category: "...",       // High-level category
        topic: "...",          // Specific topic
        // ... custom fields
    }
}
```

**Best practices:**
- Use meaningful IDs for tracing
- Add metadata for filtering
- Keep documents focused (one topic per doc)
- Chunk large documents appropriately

### 4. Add Documents to Vector Store

```javascript
async function addDocumentsToStore(vectorStore, embeddingContext, documents) {
    for (const doc of documents) {
        const embedding = await embeddingContext.getEmbeddingFor(doc.pageContent);
        const metadata = {
            content: doc.pageContent,
            ...doc.metadata,
        };
        await vectorStore.insert(
            NS,
            doc.metadata.id,
            Array.from(embedding.vector),
            metadata
        );
    }
}
```

**What it does:**
- Embeds each document's content
- Stores vector + metadata in vector DB
- Uses namespace for organization

**Step-by-step:**
1. Generate embedding for document content
2. Combine content with metadata
3. Insert into vector store with ID

**Why store content in metadata:**
- Vector DB returns metadata with search results
- Avoids separate lookup for content
- Convenient for context assembly

**Performance:**
- Embedding: ~45ms per document
- Insert: ~1ms per document
- Total: ~46ms per document

### 5. Retrieve Documents

```javascript
async function retrieveDocuments(vectorStore, embeddingContext, query, k = 3) {
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    return results;
}
```

**What it does:**
- Embeds the query
- Searches vector store for top-k similar documents
- Returns ranked results with similarity scores

**Return format:**
```javascript
[
    {
        id: "doc_1",
        similarity: 0.8734,
        metadata: {
            content: "...",
            category: "...",
            topic: "...",
        }
    },
    // ... k results
]
```

**Key parameters:**
- `k`: Number of documents to retrieve
- Default `k=3`: Good balance for most use cases

**Similarity scores:**
- Range: 0.0 to 1.0 (cosine similarity)
- > 0.7: Highly relevant
- 0.5-0.7: Relevant
- < 0.5: Less relevant

### 6. Build Context

```javascript
function buildContext(retrievedDocs) {
    if (retrievedDocs.length === 0) {
        return "";
    }
    
    const contextParts = retrievedDocs.map((doc, idx) => 
        `[${idx + 1}] ${doc.metadata.content}`
    );
    
    return contextParts.join("\n\n");
}
```

**What it does:**
- Formats retrieved documents into single context string
- Adds numbering for reference
- Separates documents with blank lines

**Example output:**
```
[1] Python is a high-level programming language known for its simplicity...

[2] JavaScript is the primary language for web browsers...

[3] Machine learning is a subset of artificial intelligence...
```

**Why this format:**
- Clear separation between documents
- Easy for LLM to parse
- Numbered references for citation
- Blank lines improve readability

**Alternatives:**
```javascript
// With similarity scores
`[${idx + 1}] (Score: ${doc.similarity.toFixed(2)}) ${doc.metadata.content}`

// With metadata
`[${idx + 1}] Category: ${doc.metadata.category}
Content: ${doc.metadata.content}`
```

### 7. Generate Answer

```javascript
async function generateAnswer(chatSession, query, context) {
    if (!context || context.trim().length === 0) {
        const prompt = `Question: ${query}\n\nYou don't have any relevant information to answer this question. Please say so politely.`;
        return await chatSession.prompt(prompt, { maxTokens: 150 });
    }
    
    const prompt = `You are a helpful assistant. Use the following context to answer the question. If the context doesn't contain relevant information, say so.

Context:
${context}

Question: ${query}

Answer:`;
    
    return await chatSession.prompt(prompt, { maxTokens: 200 });
}
```

**What it does:**
- Handles two cases: with context and without
- Formats prompt with context and question
- Generates answer using LLM

**Case 1: No context**
```javascript
if (!context || context.trim().length === 0) {
    // Ask LLM to acknowledge lack of information
}
```

**Case 2: With context**
```javascript
const prompt = `System instruction + Context + Question`;
```

**Prompt engineering:**
- Clear system instruction
- Context placed before question
- Explicit instruction to use context
- Safety: "If context doesn't help, say so"

**maxTokens parameter:**
- 150-200 tokens: Short answers
- 500+ tokens: Detailed answers
- Balance: completeness vs latency

### 8. Complete RAG Pipeline

```javascript
async function ragPipeline(vectorStore, embeddingContext, chatSession, query, k = 3) {
    // Step 1: Retrieve relevant documents
    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, k);
    
    // Step 2: Build context from retrieved documents
    const context = buildContext(retrievedDocs);
    
    // Step 3: Generate answer using LLM with context
    const answer = await generateAnswer(chatSession, query, context);
    
    return { retrievedDocs, context, answer };
}
```

**What it does:**
- Orchestrates the three-step RAG process
- Returns all intermediate results for inspection
- Provides complete transparency

**Three steps:**
1. **Retrieve**: Vector search for relevant documents
2. **Assemble**: Format documents into context
3. **Generate**: LLM creates answer using context

**Return object:**
```javascript
{
    retrievedDocs: [...],  // Array of retrieved documents
    context: "...",        // Formatted context string
    answer: "..."          // LLM-generated answer
}
```

**Why return everything:**
- Debugging: Inspect what was retrieved
- Logging: Track retrieval quality
- UI: Show sources to users
- Testing: Verify each step

---

## Example 1: Basic RAG Pipeline

```javascript
async function example1() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await initializeEmbeddingModel();
    const chatSession = await initializeLLM();
    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    const query = "What is Python?";
    const { retrievedDocs, context, answer } = await ragPipeline(
        vectorStore, embeddingContext, chatSession, query, 3
    );

    // Display results...
}
```

**What it demonstrates:**
- Complete end-to-end RAG pipeline
- All three steps visualized
- Clear separation of concerns

**Expected output:**
```
Query: What is Python?

Step 1 - Retrieved Documents: (k=3)
1. [0.8734] Python is a high-level programming language known for its...
2. [0.6521] JavaScript is the primary language for web browsers...
3. [0.5892] Machine learning is a subset of artificial intelligence...

Step 2 - Context Assembled:
[1] Python is a high-level programming language...
[2] JavaScript is the primary language...
[3] Machine learning is a subset...

Step 3 - Generated Answer:
Python is a high-level programming language known for its simplicity and 
readability, widely used in data science, web development, and automation.
```

**Key insight:**
- Top document has high similarity (0.87)
- Answer is grounded in retrieved content
- RAG provides accurate, specific information

---

## Example 2: Varying k Parameter

```javascript
async function example2() {
    // ... setup code
    
    const query = "Tell me about artificial intelligence";
    const kValues = [1, 3, 5];

    for (const k of kValues) {
        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, k
        );
        // Compare results...
    }
}
```

**What it demonstrates:**
- Impact of k on retrieval and answers
- Trade-offs between precision and recall
- How to choose k for your use case

**Comparison:**

**k=1:**
```
Retrieved: 1 document
Pros: Fast, focused
Cons: Might miss important context
Answer: Brief, based on single source
```

**k=3:**
```
Retrieved: 3 documents
Pros: Balanced, good coverage
Cons: None (recommended default)
Answer: Comprehensive, multi-faceted
```

**k=5:**
```
Retrieved: 5 documents
Pros: Maximum context
Cons: May include less relevant docs, more tokens
Answer: Detailed but potentially noisy
```

**Best practice:**
- Start with k=3
- Increase if answers lack detail
- Monitor similarity scores of last docs
- If last doc has similarity < 0.4, reduce k

---

## Example 3: Retrieval Quality Impact

```javascript
async function example3() {
    const queries = [
        { query: "What is machine learning?", expected: "high relevance" },
        { query: "How does Docker work?", expected: "medium relevance" },
        { query: "What's the weather today?", expected: "no relevance" },
    ];

    for (const { query, expected } of queries) {
        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, 3
        );
        // Analyze similarity scores...
    }
}
```

**What it demonstrates:**
- How similarity scores indicate retrieval quality
- LLM behavior with high vs low quality retrieval
- Importance of handling out-of-domain queries

**Scenario 1: High Relevance**
```
Query: "What is machine learning?"
Top doc similarity: 0.87
Answer: Accurate, detailed, grounded in context
```

**Scenario 2: Medium Relevance**
```
Query: "How does Docker work?"
Top doc similarity: 0.62
Answer: Reasonable, but may lack specifics
```

**Scenario 3: No Relevance**
```
Query: "What's the weather today?"
Top doc similarity: 0.18
Answer: "I don't have information about that..."
```

**Key insight:**
- Similarity > 0.7: High confidence
- Similarity 0.5-0.7: Medium confidence
- Similarity < 0.5: Consider filtering or returning "no info"

---

## Example 4: With vs Without Retrieval

```javascript
async function example4() {
    const query = "What is React used for?";
    
    // Without retrieval (LLM only)
    const answerNoRAG = await chatSession.prompt(query, { maxTokens: 150 });
    
    // With retrieval (RAG)
    const { retrievedDocs, answer } = await ragPipeline(
        vectorStore, embeddingContext, chatSession, query, 3
    );
}
```

**What it demonstrates:**
- Direct comparison of LLM-only vs RAG
- Value of grounding in specific knowledge base
- How RAG reduces hallucinations

**Without RAG:**
```
Q: "What is React used for?"
A: "React is a popular JavaScript library for building user interfaces. 
    It was created by Facebook and is widely used in web development..."
```
Generic answer, could apply to many libraries

**With RAG:**
```
Q: "What is React used for?"
Retrieved: [React documentation from knowledge base]
A: "According to the context, React is a JavaScript library for building 
    user interfaces, developed by Facebook. It uses a component-based 
    architecture and virtual DOM."
```
Specific answer grounded in your knowledge base

**Key differences:**
- RAG: Cites specific knowledge base
- RAG: Consistent with your documentation
- RAG: Can include company-specific details
- RAG: Reduces hallucination risk

---

## Example 5: Filtering Low-Quality Retrievals

```javascript
async function example5() {
    const query = "What's the capital of Australia?";
    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, 5);

    // Apply similarity threshold
    const threshold = 0.3;
    const filtered = retrievedDocs.filter(doc => doc.similarity > threshold);
    
    const context = buildContext(filtered);
    const answer = await generateAnswer(chatSession, query, context);
}
```

**What it demonstrates:**
- Importance of filtering low-quality results
- How to set and apply similarity thresholds
- Graceful handling of out-of-domain queries

**Without filtering:**
```
Retrieved 5 documents:
1. [0.28] Python is a programming language...
2. [0.25] JavaScript runs in browsers...
3. [0.23] Docker containers provide...
4. [0.21] SQL databases use...
5. [0.18] Git is a version control...

Problem: All docs are noise, LLM tries to answer anyway → Wrong answer
```

**With filtering (threshold = 0.3):**
```
Retrieved 5 documents:
After filtering: 0 documents (all below threshold)

Result: "I don't have information about that in my knowledge base."
```

**Choosing threshold:**
- **0.5+**: Very strict, high precision
- **0.4**: Balanced (recommended)
- **0.3**: Permissive, higher recall
- **< 0.3**: Too permissive, lots of noise

**Best practice:**
```javascript
const SIMILARITY_THRESHOLD = 0.4;

const filtered = docs.filter(d => d.similarity > SIMILARITY_THRESHOLD);

if (filtered.length === 0) {
    return "No relevant information found in knowledge base.";
}
```

---

## Example 6: Context Window Management

```javascript
async function example6() {
    const query = "programming languages";
    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, 5);

    // Show context sizes
    for (let k = 1; k <= 5; k++) {
        const context = buildContext(retrievedDocs.slice(0, k));
        const tokens = Math.ceil(context.length / 4); // Rough estimate
        console.log(`k=${k}: ${context.length} chars (~${tokens} tokens)`);
    }
}
```

**What it demonstrates:**
- How context size grows with k
- Token estimation techniques
- Balancing context size with model limits

**Example output:**
```
k=1: 142 chars (~36 tokens)
k=2: 296 chars (~74 tokens)
k=3: 451 chars (~113 tokens)
k=4: 608 chars (~152 tokens)
k=5: 762 chars (~191 tokens)
```

**Context window considerations:**

**Llama 3.2 1B (2048 token context):**
```
Total budget: 2048 tokens
- System prompt: ~50 tokens
- Question: ~20 tokens
- Context (k=3): ~150 tokens
- Answer space: ~1828 tokens ✅
```

**With k=10:**
```
Total budget: 2048 tokens
- System prompt: ~50 tokens
- Question: ~20 tokens
- Context (k=10): ~500 tokens
- Answer space: ~1478 tokens ✅ (still okay)
```

**Best practices:**
- Keep context < 25% of total window for small models
- Monitor actual token usage
- Reduce k if hitting context limits
- Consider truncating long documents

**Token estimation:**
```javascript
// Rough estimate: 1 token ≈ 4 characters
const estimatedTokens = text.length / 4;

// Better: Use tokenizer
const tokens = tokenizer.encode(text).length;
```

---

## Example 7: Batch Processing

```javascript
async function example7() {
    const queries = [
        "What is Python?",
        "Explain neural networks",
        "What is Docker?",
    ];

    const startTime = Date.now();

    for (const query of queries) {
        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, 2
        );
    }

    const totalTime = Date.now() - startTime;
    console.log(`Total time: ${totalTime}ms`);
}
```

**What it demonstrates:**
- Processing multiple queries
- Performance characteristics at scale
- Sequential vs parallel considerations

**Sequential processing:**
```javascript
for (const query of queries) {
    await ragPipeline(query);
}
// Time: 3 × 500ms = 1500ms
```

**Why sequential (current example):**
- LLM context state is maintained
- Simpler code
- Acceptable for moderate loads

**When to parallelize:**
```javascript
// Parallel retrieval (embeddings + search)
const embeddings = await Promise.all(
    queries.map(q => embed(q))
);
const retrievals = await Promise.all(
    embeddings.map(e => search(e))
);

// Sequential generation (LLM state management)
for (const [query, docs] of zip(queries, retrievals)) {
    await generate(query, docs);
}
```

**Best practice:**
- Parallelize embeddings (independent)
- Parallelize searches (read-only)
- Keep generation sequential (stateful)

---

## Performance Optimization

### Latency Breakdown

```
Typical RAG query: ~500ms
├── Query embedding: 45ms (9%)
├── Vector search: 5ms (1%)
├── Context assembly: 2ms (<1%)
└── LLM generation: 448ms (90%)
```

**Key insight:** LLM generation is the bottleneck!

### Optimization Strategies

**1. Use Smaller/Faster LLM**
```javascript
// Instead of 7B model: ~800ms
// Use 1B model: ~400ms
// Speedup: 2x
```

**2. Cache Query Embeddings**
```javascript
const embedCache = new Map();

async function getEmbedding(query) {
    if (!embedCache.has(query)) {
        embedCache.set(query, await embed(query));
    }
    return embedCache.get(query);
}
// Saves 45ms per cached query
```

**3. Reduce Context Size**
```javascript
// k=5 with long docs: ~500ms generation
// k=3 with same docs: ~450ms generation
// Speedup: 10%
```

**4. Batch Embeddings**
```javascript
// Sequential: 3 × 45ms = 135ms
const embs = [];
for (const q of queries) {
    embs.push(await embed(q));
}

// Parallel: max(45ms) = 45ms
const embs = await Promise.all(queries.map(embed));
// Speedup: 3x
```

---

## Best Practices Summary

### 1. Parameter Tuning

```javascript
// Good defaults
const k = 3;                           // Number of docs
const similarityThreshold = 0.4;       // Quality filter
const maxTokens = 200;                 // Answer length
```

### 2. Error Handling

```javascript
try {
    const { retrievedDocs, answer } = await ragPipeline(query, k);
    
    if (retrievedDocs.length === 0) {
        return "No documents found.";
    }
    
    if (retrievedDocs[0].similarity < 0.3) {
        return "No relevant information in knowledge base.";
    }
    
    return answer;
} catch (error) {
    console.error("RAG error:", error);
    return "Sorry, I encountered an error processing your question.";
}
```

### 3. Logging and Monitoring

```javascript
console.log({
    query,
    retrieved: docs.length,
    topSimilarity: docs[0]?.similarity,
    contextLength: context.length,
    latency: {
        embedding: embedTime,
        search: searchTime,
        generation: genTime,
        total: totalTime
    }
});
```

### 4. Quality Checks

```javascript
// Check retrieval quality
if (docs[0].similarity < 0.5) {
    console.warn("Low retrieval quality for query:", query);
}

// Check context size
if (context.length > 2000) {
    console.warn("Large context:", context.length, "chars");
}

// Verify answer
if (answer.includes("I don't know") && docs.length > 0) {
    console.warn("LLM couldn't answer despite retrieved docs");
}
```

---

## Common Patterns

### Pattern 1: Similarity Threshold Filtering

```javascript
const docs = await retrieve(query, k=10);
const filtered = docs.filter(d => d.similarity > 0.4);
const context = buildContext(filtered);
```

### Pattern 2: Metadata-Based Filtering

```javascript
const docs = await retrieve(query, k=10);
const filtered = docs
    .filter(d => d.similarity > 0.3)
    .filter(d => d.metadata.category === "programming");
const context = buildContext(filtered);
```

### Pattern 3: Graceful Degradation

```javascript
let k = 5;
let docs = await retrieve(query, k);

while (docs.length > 0 && docs[0].similarity < 0.3) {
    k--;
    if (k === 0) return "No relevant information found.";
    docs = await retrieve(query, k);
}
```

### Pattern 4: Source Citation

```javascript
const context = docs.map((doc, idx) => 
    `[Source ${idx + 1}: ${doc.id}]\n${doc.metadata.content}`
).join("\n\n");

const prompt = `${context}\n\nQuestion: ${query}\n\nAnswer (cite sources):`;
```

---

## Summary

### What We Built

Seven examples demonstrating:
1. ✅ Basic RAG pipeline (3 steps)
2. ✅ Impact of k parameter
3. ✅ Retrieval quality analysis
4. ✅ With vs without RAG comparison
5. ✅ Similarity threshold filtering
6. ✅ Context window management
7. ✅ Batch query processing

### Core Components

- **Embedding model**: Converts text to vectors
- **Vector store**: Stores and searches document vectors
- **Retrieval**: Top-k similarity search
- **Context assembly**: Formats docs for LLM
- **LLM generation**: Produces answers from context

### Key Takeaways

**RAG = Retrieval + Augmented Generation**

**Three steps:**
1. Retrieve: Vector search (k=3)
2. Assemble: Format context
3. Generate: LLM + context → answer

**Best practices:**
- Start with k=3
- Filter by similarity (> 0.4)
- Monitor context size
- Handle edge cases
- Log everything initially
- Compare with/without RAG

**Performance:**
- Retrieval: ~50ms (10%)
- Generation: ~450ms (90%)
- Optimize generation first

### Next Steps

- **Advanced Retrieval**: Re-ranking, query expansion, hybrid search
- **Production**: Caching, error handling, monitoring
- **Evaluation**: Metrics, A/B testing, user feedback

Master basic retrieval, and you've mastered the foundation of RAG systems!
