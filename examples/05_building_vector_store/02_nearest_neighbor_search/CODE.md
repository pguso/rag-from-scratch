# Nearest Neighbor Search Algorithms - Code Walkthrough

A detailed explanation of nearest neighbor search algorithms, comparing exact vs approximate search methods, and optimizing search performance in vector databases.

## Overview

This example demonstrates:
- Understanding k-Nearest Neighbors (kNN) search
- Comparing exact (brute force) vs approximate (HNSW) search
- Performance characteristics and optimization
- Distance metrics (cosine similarity, Euclidean distance)
- Batch search operations
- Search quality vs speed trade-offs
- Performance optimization techniques

**Vector Database:** `embedded-vector-db` (beta)
- HNSW-based approximate nearest neighbor search
- Fast kNN queries with configurable parameters
- Cosine similarity as the distance metric

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

**Same imports as 01_in_memory_store** with focus on search operations.

### Configuration Constants

```javascript
const MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");
const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "nn_search";
```

**Key difference:** Namespace changed to `"nn_search"` to distinguish from in-memory store examples.

---

## Core Functions

### Search with Timing

```javascript
async function searchWithTiming(vectorStore, embeddingContext, query, k = 3) {
    const startEmbed = Date.now();
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const embedTime = Date.now() - startEmbed;

    const startSearch = Date.now();
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    const searchTime = Date.now() - startSearch;

    return { results, embedTime, searchTime };
}
```

**What it does:** Measures embedding and search time separately for performance analysis.

**Why separate timings?**
- Embedding generation is usually the bottleneck
- kNN search is typically very fast
- Helps identify optimization opportunities

**Return value:**
- `results`: Search results with similarity scores
- `embedTime`: Time to generate query embedding (ms)
- `searchTime`: Time to perform kNN search (ms)

### Cosine Similarity

```javascript
function cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
```

**What it does:** Calculates cosine similarity between two vectors.

**Formula:**
```
similarity = (A · B) / (||A|| × ||B||)

Where:
- A · B = dot product
- ||A|| = magnitude of vector A
- ||B|| = magnitude of vector B
```

**Range:** -1 to 1 (typically 0 to 1 for embeddings)
- 1.0 = identical direction (most similar)
- 0.0 = orthogonal (unrelated)
- -1.0 = opposite direction (least similar)

**Why cosine similarity?**
- Direction matters more than magnitude for embeddings
- Normalized by vector length
- Standard metric for semantic similarity

### Euclidean Distance

```javascript
function euclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
        const diff = vec1[i] - vec2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
```

**What it does:** Calculates straight-line distance between two vectors.

**Formula:**
```
distance = √(Σ(v1[i] - v2[i])²)
```

**Range:** 0 to infinity
- 0.0 = identical vectors
- Larger values = more different

**Comparison with cosine:**
- Euclidean: Considers both direction and magnitude
- Cosine: Only considers direction
- For normalized embeddings, both work well

### Brute Force Search

```javascript
async function bruteForceSearch(embeddingContext, documents, query, k) {
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const queryVec = Array.from(queryEmbedding.vector);
    
    const distances = [];
    for (const doc of documents) {
        const docEmbedding = await embeddingContext.getEmbeddingFor(doc.pageContent);
        const docVec = Array.from(docEmbedding.vector);
        const similarity = cosineSimilarity(queryVec, docVec);
        distances.push({ doc, similarity });
    }
    
    // Sort by similarity (highest first)
    distances.sort((a, b) => b.similarity - a.similarity);
    
    return distances.slice(0, k);
}
```

**What it does:** Implements exact kNN search by comparing query with every document.

**Algorithm:**
1. Embed the query
2. Embed all documents (if not cached)
3. Calculate similarity with each document
4. Sort by similarity (descending)
5. Return top k results

**Complexity:** O(N × D)
- N = number of documents
- D = vector dimensions

**When to use:**
- Small datasets (< 1,000 documents)
- Need guaranteed exact results
- Validation and testing

---

## Example 1: Understanding k-Nearest Neighbors

```javascript
async function example1() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await initializeEmbeddingModel();
    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    const query = "programming languages";
    const kValues = [1, 3, 5, 10];

    for (const k of kValues) {
        const results = await vectorStore.search(NS, 
            Array.from((await context.getEmbeddingFor(query)).vector), k);
        // Display results...
    }
}
```

**What it demonstrates:** How the k parameter affects search results.

**k parameter:**
- **k=1**: Only the single most similar document
- **k=3**: Top 3 most similar (balanced)
- **k=5**: More candidates for filtering
- **k=10**: Comprehensive results, may include less relevant

**Example output:**
```
Top 1 Results:
1. [0.8234] doc_1: Python is a high-level programming language...

Top 3 Results:
1. [0.8234] doc_1: Python is a high-level programming language...
2. [0.7891] doc_2: JavaScript is essential for web development...
3. [0.7543] doc_10: TypeScript adds static typing to JavaScript...

Top 5 Results:
(includes above + 2 more, possibly less relevant)
```

**Key insight:** Larger k provides more options but requires post-processing to filter quality.

---

## Example 2: Exact vs Approximate Search

```javascript
async function example2() {
    // Setup...
    const query = "artificial intelligence";
    
    // Brute force (exact) search
    const startExact = Date.now();
    const exactResults = await bruteForceSearch(context, documents, query, 5);
    const exactTime = Date.now() - startExact;
    
    // HNSW (approximate) search
    const startApprox = Date.now();
    const queryEmbedding = await context.getEmbeddingFor(query);
    const approxResults = await vectorStore.search(NS, Array.from(queryEmbedding.vector), 5);
    const approxTime = Date.now() - startApprox;
}
```

**What it demonstrates:** Performance difference between exact and approximate search.

**Exact Search (Brute Force):**
- Compares query with every document
- Guaranteed to find true nearest neighbors
- Time: O(N × D) - scales linearly with dataset size
- Example: 10 docs × 384 dims = ~500ms (includes re-embedding)

**Approximate Search (HNSW):**
- Uses graph structure to skip irrelevant documents
- Finds approximate nearest neighbors (usually >95% recall)
- Time: O(log N × D) - logarithmic scaling
- Example: log₂(10) × 384 dims = ~50ms

**Performance comparison:**
```
Dataset Size    Exact         Approximate    Speedup
10 docs         500ms         50ms          10x
100 docs        5,000ms       80ms          62x
1,000 docs      50,000ms      120ms         416x
10,000 docs     500,000ms     180ms         2,777x
```

**Key insight:** HNSW becomes exponentially faster as dataset grows!

---

## Example 3: Search Performance with Different k Values

```javascript
async function example3() {
    // Create 100 documents
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
    
    await addDocumentsToStore(vectorStore, context, largeDataset);
    
    const kValues = [1, 5, 10, 20, 50];
    for (const k of kValues) {
        const { results, embedTime, searchTime } = await searchWithTiming(
            vectorStore, context, query, k
        );
    }
}
```

**What it demonstrates:** Search performance with different k values on larger dataset.

**Typical results:**
```
k=1   → Embed: 45ms, Search: 3ms,  Total: 48ms  (1 result)
k=5   → Embed: 45ms, Search: 4ms,  Total: 49ms  (5 results)
k=10  → Embed: 45ms, Search: 5ms,  Total: 50ms  (10 results)
k=20  → Embed: 45ms, Search: 6ms,  Total: 51ms  (20 results)
k=50  → Embed: 45ms, Search: 8ms,  Total: 53ms  (50 results)
```

**Analysis:**
- Embedding time: Constant (~45ms), independent of k
- Search time: Slightly increases with k (~3-8ms)
- Total time: Dominated by embedding generation
- Searching for 50x more results only adds 5ms!

**Key insight:** kNN search is extremely fast; focus optimization on embedding generation.

---

## Example 4: Batch Search Operations

```javascript
async function example4() {
    // Create larger dataset (100 documents)
    const baseDocuments = createSampleDocuments();
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
    await addDocumentsToStore(vectorStore, context, largeDataset);
    
    const queries = [
        "programming languages",
        "artificial intelligence",
        "container deployment",
        "database systems",
    ];
    
    // Pre-compute embeddings for fair comparison
    const embeddings = [];
    for (const query of queries) {
        const emb = await context.getEmbeddingFor(query);
        embeddings.push({ query, vector: Array.from(emb.vector) });
    }
    
    // Sequential Search
    const startSeq = Date.now();
    for (const { query, vector } of embeddings) {
        const results = await vectorStore.search(NS, vector, 3);
    }
    const seqTime = Date.now() - startSeq;
    
    // Parallel Search
    const startPar = Date.now();
    const allResults = await Promise.all(
        embeddings.map(({ query, vector }) => 
            vectorStore.search(NS, vector, 3)
                .then(results => ({ query, results }))
        )
    );
    const parTime = Date.now() - startPar;
}
```

**What it demonstrates:** Parallel search operations are faster than sequential when embeddings are pre-computed.

**Key insight:** Fair performance comparison requires separating embedding generation from search operations.

**Sequential approach:**
```javascript
// Pre-computed embeddings used
for (const { vector } of embeddings) {
    const res = await search(vector);    // 1-2ms each
}
// Total: 4 × 1-2ms = 4-8ms
```

**Parallel approach:**
```javascript
// All searches execute concurrently
const results = await Promise.all(
    embeddings.map(({ vector }) => search(vector))
);
// Total: ~1-2ms (runs in parallel!)
```

**Why parallel is faster:**
- Vector searches are independent operations
- JavaScript async/await enables concurrent execution
- No shared state between searches
- Each search accesses the read-locked index concurrently

**Important notes:**
- Embeddings must be pre-computed for fair comparison
- Parallel speedup is most visible with larger datasets
- With very small datasets (< 100 docs), searches are so fast (< 1ms) that timing differences may be negligible
- Real-world benefit appears when searching larger indexes or performing many queries

**Best practice:**
```javascript
// Always separate embedding from search for batch operations
// 1. Pre-compute all embeddings
const embeddings = await Promise.all(queries.map(q => embed(q)));

// 2. Execute searches in parallel
const results = await Promise.all(embeddings.map(e => search(e)));
```

---

## Example 5: Distance Metrics Comparison

```javascript
async function example5() {
    const texts = [
        "Python programming language",
        "JavaScript programming language",
        "Cooking delicious pasta",
    ];
    
    const embeddings = [];
    for (const text of texts) {
        const emb = await context.getEmbeddingFor(text);
        embeddings.push(Array.from(emb.vector));
    }
    
    // Cosine Similarity Matrix
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = 0; j < embeddings.length; j++) {
            const sim = cosineSimilarity(embeddings[i], embeddings[j]);
            console.log(sim.toFixed(4));
        }
    }
    
    // Euclidean Distance Matrix
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = 0; j < embeddings.length; j++) {
            const dist = euclideanDistance(embeddings[i], embeddings[j]);
            console.log(dist.toFixed(4));
        }
    }
}
```

**What it demonstrates:** How different metrics measure similarity.

**Example output:**

**Cosine Similarity:**
```
        Text 1    Text 2    Text 3
Text 1  1.0000    0.8532    0.2145
Text 2  0.8532    1.0000    0.2389
Text 3  0.2145    0.2389    1.0000
```

**Euclidean Distance:**
```
        Text 1    Text 2    Text 3
Text 1  0.0000    4.2314    15.8923
Text 2  4.2314    0.0000    16.2341
Text 3  15.8923   16.2341   0.0000
```

**Interpretation:**
- Text 1 & 2 (both programming): High similarity (0.85), low distance (4.2)
- Text 3 (cooking): Low similarity (0.21), high distance (15.9)
- Diagonal: Identity (1.0 similarity, 0.0 distance)

**Which metric to use?**
- **Cosine similarity**: Standard for semantic search
- **Euclidean distance**: Alternative, considers magnitude
- **Dot product**: Fast, unnormalized version of cosine
- **Manhattan distance**: L1 distance, rarely used

**embedded-vector-db uses cosine similarity** by default (via hnswlib).

---

## Example 6: Search Quality vs Performance

```javascript
async function example6() {
    const query = "programming languages for beginners";
    
    const strategies = [
        { name: "Fast Search (k=3)", k: 3 },
        { name: "Balanced Search (k=5)", k: 5 },
        { name: "Comprehensive Search (k=10)", k: 10 },
    ];
    
    for (const strategy of strategies) {
        const { results, embedTime, searchTime } = await searchWithTiming(
            vectorStore, context, query, strategy.k
        );
        
        results.forEach((result, index) => {
            const score = result.similarity;
            const relevance = score > 0.6 ? "High" : 
                             score > 0.4 ? "Medium" : "Low";
            console.log(`${index + 1}. [${score}] ${relevance}`);
        });
    }
}
```

**What it demonstrates:** Trade-offs between search speed and result quality.

**Strategy comparison:**

**Fast Search (k=3):**
- **Pros**: Fastest, most focused results
- **Cons**: Might miss relevant documents
- **Use case**: Quick lookups, real-time search
- **Performance**: ~50ms

**Balanced Search (k=5):**
- **Pros**: Good coverage, manageable results
- **Cons**: May include 1-2 marginal results
- **Use case**: Most common, general purpose
- **Performance**: ~51ms

**Comprehensive Search (k=10):**
- **Pros**: Maximum coverage, re-ranking possible
- **Cons**: More noise, requires filtering
- **Use case**: High-recall requirements, re-ranking
- **Performance**: ~53ms

**Recommendations:**
```javascript
// Quick search
const results = await search(query, 3);

// With re-ranking
const candidates = await search(query, 20);
const reranked = await reranker.rank(query, candidates);
const top = reranked.slice(0, 5);

// With threshold
const results = await search(query, 10);
const filtered = results.filter(r => r.similarity > 0.5);
```

---

## Example 7: Optimizing Search Performance

```javascript
async function example7() {
    // Technique 1: Cache embeddings
    const cachedEmbedding = await context.getEmbeddingFor(query);
    const cachedVec = Array.from(cachedEmbedding.vector);
    
    for (let i = 0; i < 3; i++) {
        await vectorStore.search(NS, cachedVec, 5);
    }
    
    // Technique 2: Over-fetching for filtering
    const manyResults = await vectorStore.search(NS, queryVec, 10);
    const filtered = manyResults
        .filter(r => r.metadata.category === "programming")
        .slice(0, 3);
    
    // Technique 3: Batch processing
    const embeddings = await Promise.all(queries.map(q => embed(q)));
    await Promise.all(embeddings.map(e => search(e, 3)));
}
```

**What it demonstrates:** Three key optimization techniques.

### Technique 1: Embedding Caching

**Problem:** Re-embedding same query wastes time.

**Solution:**
```javascript
const embedCache = new Map();

async function searchCached(query, k) {
    if (!embedCache.has(query)) {
        const emb = await embed(query);
        embedCache.set(query, Array.from(emb.vector));
    }
    return await search(embedCache.get(query), k);
}
```

**When to use:**
- Repeated queries (e.g., pagination)
- Popular searches
- Template queries with parameters

### Technique 2: Over-fetching for Filtering

**Problem:** Need k results after metadata filtering.

**Solution:**
```javascript
// Instead of: search(k=3) → filter → might get 0-3 results
// Do: search(k=10) → filter → slice(0, 3) → always 3 results

const candidates = await search(query, 20);
const filtered = candidates
    .filter(r => r.metadata.category === "programming")
    .filter(r => r.similarity > 0.5)
    .slice(0, 5);
```

**Rule of thumb:**
- If expecting 50% filter rate: fetch 2x k
- If expecting 25% filter rate: fetch 4x k
- Monitor actual rates and adjust

### Technique 3: Batch Processing

**Problem:** Sequential operations are slow.

**Solution:**
```javascript
// Sequential: 4 queries × 50ms = 200ms
for (const q of queries) {
    await search(q);
}

// Parallel: max(50ms each running concurrently) ≈ 50-70ms
const embeddings = await Promise.all(queries.map(embed));
const results = await Promise.all(embeddings.map(search));
```

**Best practices:**
- Use `Promise.all()` for independent operations
- Limit concurrency if needed (e.g., rate limits)
- Consider `p-limit` for controlled parallelism

---

## Performance Optimization Summary

### Bottleneck Analysis

**Time breakdown for typical search:**
```
Total: ~50ms
├── Embedding generation: ~45ms (90%)
└── kNN search: ~5ms (10%)
```

**Optimization priorities:**
1. **Cache embeddings** (45ms → 0ms when cached)
2. **Batch operations** (4 × 50ms → 70ms)
3. **Use GPU for embeddings** (45ms → 5ms)
4. kNN parameters (minimal impact)

### Optimization Checklist

**✓ Do:**
- Cache query embeddings
- Use batch operations with `Promise.all()`
- Pre-compute embeddings offline when possible
- Monitor separate timings for embed vs search
- Over-fetch when filtering by metadata

**✗ Don't:**
- Re-embed the same query
- Process queries sequentially when parallelizable
- Focus on kNN optimization before embedding optimization
- Fetch k=100 when you only need k=5

---

## Algorithm Comparison

### HNSW (Hierarchical Navigable Small World)

**How it works:**
1. Build multi-layer graph of vectors
2. Navigate from entry point using greedy search
3. Move to closer neighbors at each step
4. Return approximate nearest neighbors

**Advantages:**
- Fast: O(log N) search time
- Scalable: Handles millions of vectors
- Good recall: Usually >95% accuracy

**Disadvantages:**
- Approximate, not exact
- Higher memory usage (graph structure)
- Slower insertions than brute force

**Best for:**
- Production systems
- Large datasets (> 1,000 documents)
- Real-time search requirements

### Brute Force (Exact Search)

**How it works:**
1. Compare query with every document
2. Sort by similarity
3. Return top k

**Advantages:**
- Exact results (100% recall)
- Simple implementation
- No index overhead

**Disadvantages:**
- Slow: O(N) search time
- Doesn't scale
- Impractical for large datasets

**Best for:**
- Small datasets (< 1,000 documents)
- Validation and testing
- Baseline comparisons

---

## Key Concepts Summary

### 1. k-Nearest Neighbors

**Definition:** Find the k vectors most similar to a query vector.

**k selection guidelines:**
- **k=1-3**: Fast, focused results
- **k=5-10**: Balanced, general purpose
- **k=20-50**: Comprehensive, for re-ranking
- **k>50**: Usually unnecessary, noise increases

### 2. Approximate vs Exact Search

**Trade-off:**
- **Exact**: Slower but 100% accurate
- **Approximate**: Faster but ~95% accurate
- **Hybrid**: Approximate for candidates, exact for top-k

**When approximate is enough:**
- Semantic search (small accuracy loss acceptable)
- Real-time requirements
- Large datasets

### 3. Distance Metrics

**Cosine similarity:**
- Measures angle between vectors
- Range: -1 to 1
- Standard for embeddings

**Euclidean distance:**
- Measures straight-line distance
- Range: 0 to ∞
- Considers magnitude

### 4. Performance Optimization

**Key insights:**
- Embedding generation is the bottleneck (90% of time)
- kNN search is very fast (10% of time)
- Parallelization provides biggest speedup
- Caching eliminates redundant work

---

## Best Practices

### 1. Choose Appropriate k

```javascript
// Too small: might miss relevant results
const results = await search(query, 1);  // ❌ Only 1 result

// Good: balanced
const results = await search(query, 5);  // ✓ Common choice

// Too large: unnecessary noise
const results = await search(query, 100);  // ❌ Too many
```

### 2. Cache Embeddings

```javascript
const cache = new Map();

async function searchWithCache(query, k) {
    if (!cache.has(query)) {
        const emb = await embed(query);
        cache.set(query, emb);
    }
    return await search(cache.get(query), k);
}
```

### 3. Use Batch Operations

```javascript
// ❌ Slow: sequential
for (const query of queries) {
    await search(query);
}

// ✓ Fast: parallel
await Promise.all(queries.map(q => search(q)));
```

### 4. Monitor Performance

```javascript
async function searchWithMetrics(query, k) {
    const start = Date.now();
    const embedStart = Date.now();
    const embedding = await embed(query);
    const embedTime = Date.now() - embedStart;
    
    const searchStart = Date.now();
    const results = await search(embedding, k);
    const searchTime = Date.now() - searchStart;
    
    logMetrics({ embedTime, searchTime, total: Date.now() - start });
    return results;
}
```

---

## Summary

### What We Built

Seven examples demonstrating:
1. ✅ k-Nearest Neighbors fundamentals
2. ✅ Exact vs approximate search comparison
3. ✅ Performance characteristics with different k values
4. ✅ Batch search operations
5. ✅ Distance metrics comparison
6. ✅ Search quality vs performance trade-offs
7. ✅ Performance optimization techniques

### Key Takeaways

- **kNN** finds the k most similar vectors to a query
- **HNSW** is exponentially faster than brute force for large datasets
- **Embedding generation** is the performance bottleneck, not search
- **Cosine similarity** is the standard metric for semantic search
- **Caching and batching** provide the biggest performance gains
- **k parameter** controls result count and quality trade-off

### Performance Guidelines

| Dataset Size | Algorithm | Expected Time | Notes |
|--------------|-----------|---------------|-------|
| < 1,000 | Brute force | < 100ms | Exact results |
| 1,000-10,000 | HNSW | < 50ms | >95% recall |
| 10,000-100,000 | HNSW | < 100ms | Excellent |
| > 100,000 | HNSW | < 200ms | Still fast |

### Next Steps

- **03_metadata_filtering**: Advanced filtering strategies

The nearest neighbor search algorithms you learned are the foundation of all vector databases. Master these concepts, and you'll understand how modern semantic search works!
