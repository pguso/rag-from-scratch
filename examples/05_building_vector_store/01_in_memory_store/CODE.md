# Building an In-Memory Vector Store - Code Walkthrough

A detailed explanation of how to build and use an in-memory vector store for semantic search, covering the implementation and seven comprehensive examples.

## Overview

This example demonstrates:
- How to initialize an in-memory vector database
- How to add documents with embeddings
- How to perform similarity search
- How to filter results using metadata
- CRUD operations (Create, Read, Update, Delete)
- Performance characteristics
- Understanding similarity scores

**Vector Database:** `embedded-vector-db` (beta)
- Namespace-based API for data isolation
- Built on hnswlib-node for fast kNN search
- In-memory storage (no persistence in these examples)
- Full CRUD support

---

## Setup and Configuration

### Imports

```javascript
import { fileURLToPath } from "url";
import path from "path";
import { VectorDB } from "embedded-vector-db";
import { getLlama } from "node-llama-cpp";
import { Document } from "../../../src/index.js";
import { OutputHelper } from "../../../helpers/output-helper.js";
import chalk from "chalk";
```

**What's imported:**
- **`VectorDB`**: The embedded vector database class from the npm package
- **`getLlama` and node-llama-cpp**: For loading embedding models
- **`Document`**: Wrapper class for text content with metadata
- **`OutputHelper`**: Utility for formatted console output
- **`chalk`**: Terminal color formatting

### Configuration Constants

```javascript
const MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");
const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "memory";
```

**Configuration explained:**
- **`MODEL_PATH`**: Path to BGE-small embedding model (384 dimensions)
- **`DIM`**: Vector dimensions must match the embedding model
- **`MAX_ELEMENTS`**: Maximum capacity of the vector store
- **`NS`**: Namespace name for organizing vectors

**Why namespaces?**
- Isolate different collections of data
- Same database can store multiple datasets
- Example: "products", "documentation", "chat-history"

---

## Core Functions

### Initialize Embedding Model

```javascript
async function initializeEmbeddingModel() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: MODEL_PATH });
    return await model.createEmbeddingContext();
}
```

**What it does:** Loads the BGE embedding model and creates a context for generating embeddings.

**Step-by-step:**
1. Get Llama instance (handles native binaries)
2. Load the GGUF model file
3. Create embedding context (ready to generate embeddings)

**Why separate function?**
- Model loading is expensive (done once)
- Reusable across examples
- Clean separation of concerns

### Create Sample Documents

```javascript
function createSampleDocuments() {
    return [
        new Document("Python is a high-level programming language known for its simplicity.", {
            id: "doc_1",
            category: "programming",
            language: "python",
            difficulty: "beginner",
        }),
        // ... more documents
    ];
}
```

**What it does:** Creates a set of test documents with rich metadata.

**Document structure:**
- **Content**: The text to be embedded and searched
- **Metadata**: Structured data for filtering and organization
  - `id`: Unique identifier
  - `category`: Grouping field (programming, ai, devops, etc.)
  - `language`, `topic`, `difficulty`: Custom fields

**Why metadata matters:**
- Filter search results by category
- Organize documents logically
- Add context to search results

### ID Tracker Helper

```javascript
function createIdTracker() {
    const ids = new Set();
    return {
        add(id) { ids.add(id); },
        delete(id) { ids.delete(id); },
        has(id) { return ids.has(id); },
        count() { return ids.size; },
        clear() { ids.clear(); },
    };
}
const idTracker = createIdTracker();
```

**What it does:** Tracks inserted document IDs for counting and verification.

**Why needed:**
- `embedded-vector-db` is in beta, may not expose size APIs
- Simple Set-based tracker provides reliable count
- Helps demonstrate CRUD operations clearly

### Document Cache Helper

```javascript
const documentCache = new Map();
```

**What it does:** Simple in-memory cache for retrieving documents by ID.

**Why needed:**
- `embedded-vector-db` doesn't have a built-in `get()` method for retrieving by ID
- Cache stores full document metadata for quick retrieval
- Enables examples to demonstrate document retrieval patterns
- Maintained alongside the vector store during CRUD operations

### Add Documents to Store

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
        idTracker.add(doc.metadata.id);
        documentCache.set(doc.metadata.id, { id: doc.metadata.id, metadata });
    }
}
```

**What it does:** Embeds documents and inserts them into the vector store.

**Step-by-step:**
1. **Generate embedding**: Convert text to 384-dimensional vector
2. **Insert into store**: Store vector with ID and metadata
3. **Track ID**: Record that this document was added
4. **Cache document**: Store in documentCache for later retrieval by ID

**VectorDB.insert() parameters:**
- `namespace`: Data isolation (using "memory")
- `id`: Unique identifier for retrieval
- `vector`: The embedding as array of numbers
- `metadata`: All metadata including the original content

**Important:** Store the original content in metadata so you can retrieve it later!

### Search Vector Store

```javascript
async function searchVectorStore(vectorStore, embeddingContext, query, k = 3) {
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    return await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
}
```

**What it does:** Performs semantic similarity search.

**How it works:**
1. **Embed the query**: Convert search text to vector (same model!)
2. **Search**: Find k nearest neighbors using cosine similarity
3. **Return results**: Array of matches with scores and metadata

**Key insight:** Query and documents use the same embedding space, enabling semantic matching.

---

## Example 1: Basic Vector Store Setup

```javascript
async function example1() {
    const vectorStore = new VectorDB({
        dim: DIM,
        maxElements: MAX_ELEMENTS,
    });
    
    const context = await initializeEmbeddingModel();
    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);
}
```

**What it demonstrates:**
- Creating a VectorDB instance
- Loading the embedding model
- Adding documents with embeddings

**Step-by-step:**

**Step 1: Create VectorDB**
```javascript
const vectorStore = new VectorDB({
    dim: DIM,
    maxElements: MAX_ELEMENTS,
});
```
- Creates in-memory HNSW index
- Must specify dimensions (384 for BGE-small)
- Sets maximum capacity (10,000 vectors)

**Step 2: Initialize embeddings**
```javascript
const context = await initializeEmbeddingModel();
```
- Loads BGE-small model (~150MB)
- Returns embedding context ready to use

**Step 3: Add documents**
```javascript
await addDocumentsToStore(vectorStore, context, documents);
```
- Embeds each document (~50ms per document)
- Inserts vectors into HNSW index
- Stores metadata for retrieval

**Result:** Vector store ready with 10 documents, searchable by semantic similarity.

---

## Example 2: Basic Similarity Search

```javascript
async function example2() {
    // Setup (same as example1)
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await initializeEmbeddingModel();
    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);
    
    const queries = [
        "How do I learn programming?",
        "Tell me about artificial intelligence",
        "Container deployment tools",
    ];
    
    for (const query of queries) {
        const results = await searchVectorStore(vectorStore, context, query, 3);
        // Display results...
    }
}
```

**What it demonstrates:** Semantic search finds relevant documents even without exact keyword matches.

**How search works:**

**Query 1: "How do I learn programming?"**
- Doesn't contain exact keywords from documents
- Finds documents about Python, JavaScript, TypeScript
- **Why?** Embedding captures the concept of "learning programming"

**Query 2: "Tell me about artificial intelligence"**
- Matches documents about machine learning, neural networks, NLP
- **Why?** AI-related concepts cluster together in embedding space

**Query 3: "Container deployment tools"**
- Finds Docker and Kubernetes documents
- **Why?** DevOps and containerization are semantically related

**Result structure:**
```javascript
{
    id: "doc_1",
    similarity: 0.7234,  // Similarity score (0-1, higher is better)
    metadata: {
        content: "...",
        category: "programming",
        // ... other metadata
    }
}
```

**Key insight:** Vector search finds semantically similar documents, not just keyword matches!

---

## Example 3: Filtering with Metadata

```javascript
async function example3() {
    // Setup...
    const query = "programming concepts";
    
    // Search without filter
    const allResults = await searchVectorStore(vectorStore, context, query, 5);
    
    // Filter by metadata
    const filteredResults = allResults
        .filter((r) => r.metadata.category === "programming")
        .slice(0, 5);
}
```

**What it demonstrates:** Combining semantic search with metadata filtering.

**Approach shown:**
1. Search returns top matches by similarity
2. Client-side filter by metadata field
3. Take first N filtered results

**Example output:**
```
Without Filter (All Results):
1. [0.7234] programming: Python is a high-level...
2. [0.6891] ai: Machine learning models require...
3. [0.6543] programming: JavaScript is essential...
4. [0.6234] programming: React is a popular...
5. [0.5987] ai: Neural networks are inspired...

With Filter (Only "programming" category):
1. [0.7234] programming: Python is a high-level...
2. [0.6543] programming: JavaScript is essential...
3. [0.6234] programming: React is a popular...
```

**Use cases for filtering:**
- Restrict search to specific document types
- Filter by date, author, source
- Combine with difficulty level, tags, etc.

**Note:** `embedded-vector-db` also supports server-side filtering via the `metadataFilter` parameter in search(), but this example shows explicit filtering for clarity.

---

## Example 4: Performance Comparison

```javascript
async function example4() {
    // Create larger dataset
    const largeDataset = [];
    for (let i = 0; i < 10; i++) {
        baseDocuments.forEach((doc, idx) => {
            largeDataset.push(new Document(doc.pageContent, {
                ...doc.metadata,
                id: `doc_${i}_${idx}`,
                batch: i,
            }));
        });
    }
    
    // Measure add time
    const addStart = Date.now();
    await addDocumentsToStore(vectorStore, context, largeDataset);
    const addTime = Date.now() - addStart;
    
    // Test search with different k values
    const kValues = [1, 5, 10, 20];
    for (const k of kValues) {
        const searchStart = Date.now();
        const results = await searchVectorStore(vectorStore, context, query, k);
        const searchTime = Date.now() - searchStart;
    }
}
```

**What it demonstrates:** Performance characteristics of in-memory vector search.

**Results insights:**
- **Adding 100 documents**: ~5-10 seconds (mostly embedding time)
- **Average per document**: ~50-100ms (embedding generation dominates)
- **Search performance**: Very fast (< 50ms even for large k)

**Performance breakdown:**
- **Embedding generation**: 40-80ms per document
- **Vector insertion**: < 1ms per document
- **Search query embedding**: 40-80ms
- **kNN search**: < 10ms for 100 documents

**Key takeaway:** HNSW is extremely fast for search, but embedding generation is the bottleneck.

---

## Example 5: Retrieving Documents by ID

```javascript
async function example5() {
    // Setup...
    const idsToRetrieve = ["doc_1", "doc_5", "doc_10"];
    
    for (const id of idsToRetrieve) {
        const doc = documentCache.get(id);
        if (doc) {
            console.log(`ID: ${id}`);
            console.log(`Content: ${doc.metadata.content}`);
            console.log(`Category: ${doc.metadata.category}`);
            console.log(`Difficulty: ${doc.metadata.difficulty || "N/A"}`);
        } else {
            console.log(`• Not found: ${id}`);
        }
    }
}
```

**What it demonstrates:** Direct document retrieval by ID using the document cache.

**Why use documentCache:**
- `embedded-vector-db` doesn't have a built-in `get()` method
- Cache provides instant retrieval without searching
- Maintained alongside vector store during CRUD operations
- Simple pattern for small to medium datasets

**When to retrieve by ID:**
- After similarity search returns IDs, fetch full details
- Retrieve specific documents for display
- Check if a document exists
- Review existing entries before updates

**Cached object structure:**
```javascript
{
    id: "doc_1",
    metadata: {
        content: "Python is a high-level...",
        id: "doc_1",
        category: "programming",
        language: "python",
        difficulty: "beginner"
    }
}
```

**Workflow example:**
1. Search: Find top 10 similar documents
2. Get IDs: Extract IDs from results
3. Retrieve: Fetch from cache using documentCache.get(id)
4. Display: Show to user with full metadata

---

## Example 6: Updating and Deleting Documents

```javascript
async function example6() {
    // Setup with 3 documents
    const documents = createSampleDocuments().slice(0, 3);
    await addDocumentsToStore(vectorStore, context, documents);
    
    // Delete a document
    await vectorStore.delete(NS, "doc_2");
    idTracker.delete("doc_2");
    documentCache.delete("doc_2");
    
    // Add a new document
    const newDoc = new Document("GraphQL is a query language for APIs.", {
        id: "doc_11",
        category: "programming",
        topic: "api",
    });
    
    {
        const embedding = await context.getEmbeddingFor(newDoc.pageContent);
        const metadata = {
            content: newDoc.pageContent,
            ...newDoc.metadata,
        };
        await vectorStore.insert(NS, newDoc.metadata.id, Array.from(embedding.vector), metadata);
        idTracker.add(newDoc.metadata.id);
        documentCache.set(newDoc.metadata.id, { id: newDoc.metadata.id, metadata });
    }
    
    // Update existing document
    const updatedDoc = new Document(
        "Python 3.12 is the latest version with improved performance.",
        {
            id: "doc_1",
            category: "programming",
            language: "python",
            difficulty: "beginner",
            version: "3.12",
        }
    );
    
    {
        const updatedEmbedding = await context.getEmbeddingFor(updatedDoc.pageContent);
        const metadata = {
            content: updatedDoc.pageContent,
            ...updatedDoc.metadata,
        };
        await vectorStore.update(NS, updatedDoc.metadata.id, Array.from(updatedEmbedding.vector), metadata);
        documentCache.set(updatedDoc.metadata.id, { id: updatedDoc.metadata.id, metadata });
    }
    
    // Verify changes
    const doc1 = documentCache.get("doc_1");
    console.log(`Updated document content: ${doc1.metadata.content}`);
}
```

**What it demonstrates:** Full CRUD operations on the vector store with proper cache management.

**Delete operation:**
```javascript
await vectorStore.delete(NS, "doc_2");
idTracker.delete("doc_2");
documentCache.delete("doc_2");
```
- Removes vector from index
- Updates ID tracker
- Removes from document cache
- Frees up space (added to internal free list)

**Insert operation:**
```javascript
const metadata = { content: newDoc.pageContent, ...newDoc.metadata };
await vectorStore.insert(NS, id, vector, metadata);
idTracker.add(id);
documentCache.set(id, { id, metadata });
```
- Must provide new unique ID
- Throws error if ID already exists
- Stores vector and metadata in vector store
- Updates tracker and cache

**Update operation:**
```javascript
const metadata = { content: updatedDoc.pageContent, ...updatedDoc.metadata };
await vectorStore.update(NS, id, newVector, metadata);
documentCache.set(id, { id, metadata });
```
- Replaces existing vector and metadata
- Generates new embedding if content changed
- Updates document cache with new metadata
- Maintains same ID

**Why re-embed on update?**
- If content changes, embedding must change
- Ensures search results stay accurate
- Old embedding wouldn't match new content

**Cache management is critical:**
- Keep cache in sync with vector store
- Update cache on every insert, update, or delete
- Ensures documentCache.get() returns current data

**CRUD summary:**
- **Create**: `insert()` + cache.set()
- **Read**: `search()` or cache.get()
- **Update**: `update()` + cache.set()
- **Delete**: `delete()` + cache.delete()

---

## Example 7: Understanding Similarity Scores

```javascript
async function example7() {
    const testCases = [
        { query: "Python programming", description: "Very specific match" },
        { query: "coding and software", description: "Broad programming topic" },
        { query: "containers and deployment", description: "DevOps related" },
    ];
    
    for (const tc of testCases) {
        const results = await searchVectorStore(vectorStore, context, tc.query, 5);
        
        results.forEach((result) => {
            const score = Math.max(0, Math.min(1, result.similarity));
            const scoreBar = "█".repeat(Math.round(score * 30));
            const color = score > 0.6 ? green : score > 0.4 ? yellow : gray;
        });
    }
}
```

**What it demonstrates:** How to interpret similarity scores.

**Score interpretation:**
- **> 0.6**: High similarity - very relevant match
- **0.4–0.6**: Medium similarity - somewhat relevant
- **< 0.4**: Low similarity - less relevant

**Factors affecting scores:**
- **Query specificity**: Specific queries get higher scores
- **Document length**: Longer documents may score differently
- **Semantic overlap**: More related concepts = higher scores

**Example results:**

**Query: "Python programming" (very specific)**
```
1. 0.8234 ███████████████████████████ Python is a high-level...
2. 0.6891 █████████████████████ JavaScript is essential...
3. 0.5432 ████████████████ TypeScript adds static typing...
```

**Query: "coding and software" (broad)**
```
1. 0.6234 ███████████████████ Python is a high-level...
2. 0.5987 ██████████████████ JavaScript is essential...
3. 0.5543 ████████████████ React is a popular...
```

**Key insights:**
- More specific queries yield higher similarity scores
- Broad queries spread scores more evenly
- Threshold depends on your use case

**Setting thresholds:**
```javascript
const RELEVANCE_THRESHOLD = 0.5;
const relevantResults = results.filter(r => r.similarity > RELEVANCE_THRESHOLD);
```

---

## Configuration Options Reference

### VectorDB Initialization

```javascript
new VectorDB({
    dim: number,              // Required: vector dimensions
    maxElements: number,      // Required: maximum capacity
})
```

**Important notes:**
- `dim` must match your embedding model
- `maxElements` is permanent (can't be changed after creation)
- In-memory only (data lost when process ends)

### Insert Parameters

```javascript
await vectorStore.insert(
    namespace,     // string: namespace for isolation
    id,           // string: unique identifier
    vector,       // number[]: embedding array
    metadata      // object: any JSON-serializable data
);
```

### Search Parameters

```javascript
await vectorStore.search(
    namespace,         // string: which namespace to search
    queryVector,       // number[]: query embedding
    k,                // number: how many results to return
    metadataFilter    // object (optional): filter by metadata
);
```

**With metadata filter:**
```javascript
await vectorStore.search(NS, queryVector, 5, {
    category: "programming",
    difficulty: "beginner"
});
```
Returns only documents matching ALL filter criteria.

---

## Key Concepts Summary

### 1. Embeddings Enable Semantic Search

**Traditional keyword search:**
```
Query: "learn programming"
Matches: Documents containing "learn" AND/OR "programming"
```

**Semantic vector search:**
```
Query: "learn programming" → embedding → [0.23, -0.45, ...]
Finds: Documents with similar embeddings
- "Python is beginner-friendly" (no keyword match!)
- "JavaScript tutorial for beginners"
- "Introduction to coding"
```

### 2. Namespaces Provide Isolation

```javascript
// Different collections in one database
await db.insert("products", "p1", vector, {...});
await db.insert("users", "u1", vector, {...});
await db.insert("docs", "d1", vector, {...});

// Search only products
await db.search("products", queryVector, 5);
```

### 3. Metadata Adds Context

```javascript
// Store rich metadata
{
    content: "Document text",
    id: "doc_1",
    category: "programming",
    author: "John Doe",
    date: "2024-01-15",
    tags: ["python", "tutorial"],
    views: 1234
}

// Filter and organize
results.filter(r => r.metadata.date > "2024-01-01")
```

### 4. HNSW Is Fast

**Hierarchical Navigable Small World (HNSW):**
- Approximate nearest neighbor search
- Very fast (< 10ms for thousands of vectors)
- Good recall (finds most relevant results)
- Trade-off: Approximate, not exact

---

## When to Use In-Memory Vector Stores

### ✅ Good For:

1. **Development and prototyping**
   - Fast iteration
   - No setup required
   - Easy debugging

2. **Small datasets (< 10,000 documents)**
   - Fits in memory
   - Fast operations
   - Simple management

3. **Testing and evaluation**
   - Quick setup/teardown
   - Reproducible tests
   - No external dependencies

4. **Short-lived processes**
   - Scripts and batch jobs
   - One-time analysis
   - Temporary workloads

### ❌ Not Good For:

1. **Production applications**
   - Data lost on restart if not saved explicitly
   - No durability guarantees
   - Limited scalability

2. **Large datasets (> 10,000 documents)**
   - High memory usage
   - Slower initialization
   - Risk of OOM errors

3. **Multi-user applications**
   - No concurrent access control
   - Limited to single process
   - No distribution

4. **Long-running services**
   - Must rebuild on restart
   - No persistence
   - Memory leaks over time

---

## Comparison: In-Memory vs Persistent

| Feature | In-Memory      | Persistent (LanceDB, etc.) |
|---------|----------------|---------------------------|
| **Setup** | Instant        | Requires installation |
| **Speed** | Very fast      | Fast |
| **Persistence** | Filesystem     | Full persistence |
| **Capacity** | Limited by RAM | Limited by disk |
| **Use case** | Dev/testing    | Production |
| **Cost** | Free           | May have costs |

---

## Summary

### What We Built

Seven examples demonstrating:
1. ✅ Basic vector store setup
2. ✅ Semantic similarity search
3. ✅ Metadata filtering
4. ✅ Performance characteristics
5. ✅ Document retrieval by ID
6. ✅ CRUD operations
7. ✅ Similarity score interpretation

### Key Takeaways

- **Semantic search** finds related content, not just keywords
- **Embeddings** capture meaning in vector space
- **Metadata** enables filtering and organization
- **HNSW** provides fast approximate search
- **In-memory** is perfect for development
- **CRUD operations** work like traditional databases

### Best Practices

1. **Always store content in metadata** for retrieval
2. **Use namespaces** to isolate different collections
3. **Track IDs** for verification and counting
4. **Set relevance thresholds** based on your use case
5. **Re-embed on update** to maintain accuracy

### Next Steps

- **02_nearest_neighbor_search**: Advanced search algorithms

The in-memory vector store you built is the foundation for RAG systems. Next, you'll add persistence and scale to production workloads!
