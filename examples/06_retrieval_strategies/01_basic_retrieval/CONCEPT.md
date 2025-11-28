# Basic Retrieval Strategy - Conceptual Overview

## What is Basic Retrieval in RAG?

**Basic Retrieval** is the foundational strategy for Retrieval-Augmented Generation (RAG) systems. It combines two core components:

1. **Retrieval**: Finding relevant documents from a knowledge base using vector similarity search
2. **Augmented Generation**: Using an LLM to generate answers based on the retrieved context

This is the simplest and most common RAG pattern, forming the basis for all advanced retrieval strategies.

---

## The RAG Pipeline

### Three-Step Process

```
┌─────────────────┐
│  1. RETRIEVE    │  Find relevant documents using vector similarity
│                 │
│  User Query     │
│       ↓         │
│  Embed Query    │
│       ↓         │
│  Vector Search  │
│       ↓         │
│  Top-k Results  │
└─────────────────┘
         ↓
┌─────────────────┐
│  2. ASSEMBLE    │  Build context from retrieved documents
│                 │
│  Retrieved Docs │
│       ↓         │
│  Format Context │
│       ↓         │
│  Context String │
└─────────────────┘
         ↓
┌─────────────────┐
│  3. GENERATE    │  LLM generates answer using context
│                 │
│  Query + Context│
│       ↓         │
│  LLM Inference  │
│       ↓         │
│  Final Answer   │
└─────────────────┘
```

### Why This Works

**Without RAG (LLM Only):**
```javascript
Question: "What is our company's refund policy?"
LLM: "I don't have specific information about your company..."
```
❌ Generic answer, no specific knowledge

**With RAG (Retrieval + LLM):**
```javascript
Question: "What is our company's refund policy?"
Retrieved: [Your company's actual refund policy document]
LLM: "According to your policy, refunds are available within 30 days..."
```
✅ Specific, accurate, grounded in your data

---

## Core Components

### 1. Query Processing

**What happens:**
- User submits a natural language question
- Question is embedded into a vector (same model as documents)
- Vector represents semantic meaning of the question

**Example:**
```javascript
Query: "How do I reset my password?"
↓
Embedding: [0.234, -0.891, 0.432, ..., 0.123] // 384 dimensions
```

**Key insight:** Same embedding model must be used for both documents and queries.

### 2. Vector Similarity Search

**What happens:**
- Query vector is compared with all document vectors in the database
- Documents are ranked by similarity score (cosine similarity)
- Top-k most similar documents are retrieved

**Similarity Scores:**
```
Score Range    Interpretation
────────────────────────────
0.8 - 1.0      Highly relevant
0.6 - 0.8      Relevant  
0.4 - 0.6      Somewhat relevant
0.2 - 0.4      Marginally relevant
0.0 - 0.2      Not relevant
```

**Example:**
```javascript
Query: "machine learning algorithms"

Results:
1. [0.87] "Machine learning uses algorithms to learn from data..."
2. [0.76] "Neural networks are a type of ML algorithm..."
3. [0.68] "Supervised learning trains models on labeled data..."
4. [0.42] "Python is popular for data science..."
5. [0.21] "Databases store structured information..."
```

Top 3 are relevant; 4-5 are noise.

### 3. The k Parameter

**k** determines how many documents to retrieve.

**Trade-offs:**

| k Value | Pros | Cons | Use Case |
|---------|------|------|----------|
| k=1 | Fast, focused | May miss context | Quick lookups |
| k=3 | Balanced | Good default | General purpose |
| k=5 | More coverage | Some noise | Complex queries |
| k=10+ | Maximum context | Lots of noise | Rare; re-ranking |

**Guidelines:**
- **Start with k=3** as default
- **Increase k** if queries need multiple perspectives
- **Over-fetch** (e.g., k=10) then filter by similarity threshold
- **Consider context window**: More docs = more tokens

### 4. Context Assembly

**What happens:**
- Retrieved documents are formatted into a single context string
- Context includes document content (and optionally metadata)
- Context is inserted into the LLM prompt

**Simple Format:**
```
Context:
[1] Python is a programming language...
[2] JavaScript runs in web browsers...
[3] SQL manages database queries...
```

**Advanced Format:**
```
Context (3 documents, sorted by relevance):

[Document 1 - Similarity: 0.87]
Title: Introduction to Python
Content: Python is a high-level programming language...
Category: Programming | Date: 2024

[Document 2 - Similarity: 0.76]
Title: JavaScript Basics
Content: JavaScript enables interactive web pages...
Category: Programming | Date: 2024
```

**Key considerations:**
- Order matters: Most relevant first
- Keep formatting consistent
- Include metadata if helpful for answer quality
- Monitor total token count

### 5. Prompt Engineering for RAG

**Basic Structure:**
```
System: You are a helpful assistant. Answer based on the context.

Context:
[Retrieved documents here]

Question: [User's question]

Answer:
```

**Best Practices:**

✅ **Clear instructions:**
```
"Use the following context to answer the question.
If the context doesn't contain relevant information, say so."
```

✅ **Cite sources (optional):**
```
"Answer the question and cite which document(s) you used."
```

✅ **Set boundaries:**
```
"Only answer based on the provided context. Don't use external knowledge."
```

❌ **Too vague:**
```
"Here's some info: [context]. Question: [question]"
```

### 6. Answer Generation

**What happens:**
- LLM receives: System prompt + Context + Question
- LLM generates answer grounded in context
- Answer should be relevant, accurate, and cite context when possible

**Without Context:**
```
Q: "What is Quantum Flux Architecture?"
A: "I don't have information about that specific architecture."
```

**With Context:**
```
Context: "Quantum Flux Architecture is a novel design pattern..."
Q: "What is Quantum Flux Architecture?"
A: "Quantum Flux Architecture is a novel design pattern that..."
```

---

## Why Basic Retrieval Works

### 1. Grounds LLM in Facts

**Problem:** LLMs can hallucinate or provide outdated information.

**Solution:** RAG provides specific, up-to-date context from your knowledge base.

**Example:**
```
LLM Only: "The capital of Country X is probably City Y."
RAG: "According to our database, the capital of Country X is City Z."
```

### 2. Adds Domain-Specific Knowledge

**Problem:** LLMs lack knowledge about your company, products, or proprietary data.

**Solution:** RAG retrieves relevant internal documents.

**Example:**
```
LLM Only: "I don't know your company's policies."
RAG: "Based on your employee handbook, the vacation policy is..."
```

### 3. Provides Source Attribution

**Problem:** Hard to verify LLM claims.

**Solution:** RAG shows which documents were used.

**Example:**
```
Answer: "The project deadline is March 15."
Source: [Internal Email from Manager, Feb 20, 2024]
```

### 4. Enables Real-Time Updates

**Problem:** LLMs have training cutoff dates.

**Solution:** Knowledge base can be updated anytime.

**Example:**
```
New document added today → Immediately available in RAG system
```

---

## Common Challenges and Solutions

### Challenge 1: No Relevant Documents

**Scenario:** Query is outside knowledge base scope.

**Bad Handling:**
```javascript
// Returns low-similarity docs anyway
const results = await search(query, k=3);
// LLM tries to answer with irrelevant context → Wrong answer
```

**Good Handling:**
```javascript
const results = await search(query, k=5);
const filtered = results.filter(r => r.similarity > 0.4);

if (filtered.length === 0) {
    return "I don't have information about that in my knowledge base.";
}
```

**Best practice:** Set a similarity threshold (0.3-0.5).

### Challenge 2: Context Too Large

**Scenario:** Too many documents exceed LLM context window.

**Problem:**
```javascript
k=10, each doc = 500 tokens
Total context = 5000 tokens
Question + System = 100 tokens
Answer space = 0 tokens left! ❌
```

**Solution:**
```javascript
k=3, each doc = 500 tokens
Total context = 1500 tokens
Question + System = 100 tokens  
Answer space = 2000+ tokens ✅
```

**Best practice:** 
- Monitor token usage
- Keep context < 50% of total window
- Prioritize quality over quantity

### Challenge 3: Redundant Information

**Scenario:** Top-k results are very similar.

**Problem:**
```
1. [0.89] "Python is a programming language..."
2. [0.88] "Python is a high-level programming language..."
3. [0.87] "Python, a programming language, is..."
```
All say the same thing → Wasted context!

**Solution:** Implement diversity in advanced retrieval (next chapter).

**Basic mitigation:** Use higher k then filter duplicates.

### Challenge 4: Query-Document Mismatch

**Scenario:** Question phrasing doesn't match document phrasing.

**Example:**
```
Query: "How can I get my money back?"
Document: "Refund Policy: Returns accepted within 30 days"
Similarity: 0.45 (Medium, might not be retrieved with k=3)
```

**Solutions:**
- Use k=5-10 to increase recall
- Query expansion (advanced technique)
- Better document chunking
- Improve embeddings with fine-tuning

---

## Performance Characteristics

### Typical Latency Breakdown

```
Total RAG Query: ~500ms
├── Embed Query:        45ms  (9%)
├── Vector Search:       5ms  (1%)
├── Context Assembly:    2ms  (<1%)
└── LLM Generation:    448ms  (90%)
```

**Key insight:** LLM generation dominates latency!

### Optimization Priorities

1. **Use faster/smaller LLM** (biggest impact)
2. **Cache common queries**
3. **Reduce k** (minimal impact)
4. **Optimize embeddings** (small impact)

### Scaling Characteristics

| Documents | Search Time | Quality |
|-----------|-------------|---------|
| 100 | 2ms | Good |
| 1,000 | 5ms | Good |
| 10,000 | 10ms | Good |
| 100,000 | 20ms | Good |
| 1,000,000+ | 30-50ms | Good |

**Insight:** Vector search scales well with HNSW algorithm.

---

## Best Practices

### 1. Start Simple

```javascript
// Good: Start with basic RAG
const docs = await retrieve(query, k=3);
const answer = await generate(query, docs);
```

Don't over-engineer initially. Basic RAG works remarkably well.

### 2. Monitor Similarity Scores

```javascript
const docs = await retrieve(query, k=5);

console.log("Similarity distribution:");
docs.forEach(doc => {
    console.log(`${doc.id}: ${doc.similarity.toFixed(2)}`);
});
```

**What to look for:**
- Top doc < 0.5: Poor retrieval quality
- Large drop after k=3: Good, only need 3 docs
- All scores > 0.7: Excellent retrieval

### 3. Set Similarity Thresholds

```javascript
const SIMILARITY_THRESHOLD = 0.4;

const docs = await retrieve(query, k=5);
const filtered = docs.filter(d => d.similarity > SIMILARITY_THRESHOLD);

if (filtered.length === 0) {
    return "No relevant information found.";
}
```

### 4. Log Everything (Initially)

```javascript
console.log(`Query: ${query}`);
console.log(`Retrieved: ${docs.length} docs`);
console.log(`Top similarity: ${docs[0].similarity}`);
console.log(`Context length: ${context.length} chars`);
console.log(`Generation time: ${genTime}ms`);
```

Helps understand and debug system behavior.

### 5. Handle Edge Cases

```javascript
// No results
if (docs.length === 0) {
    return "No documents found.";
}

// Low quality results
if (docs[0].similarity < 0.3) {
    return "No relevant information in knowledge base.";
}

// Context too large
if (contextLength > MAX_TOKENS) {
    docs = docs.slice(0, k-1); // Use fewer docs
}
```

### 6. Test With and Without RAG

```javascript
// Compare answers
const answerNoRAG = await llm.generate(query);
const answerWithRAG = await ragPipeline(query);

console.log("Without RAG:", answerNoRAG);
console.log("With RAG:", answerWithRAG);
```

Verify RAG actually improves answer quality.

---

## When Basic Retrieval is Enough

### ✅ Good Use Cases

**1. Internal Knowledge Base**
- Company wikis
- Documentation
- FAQs
- Policies and procedures

**2. Question Answering**
- Customer support
- Employee onboarding
- Product information
- Technical documentation

**3. Content Summarization**
- Report generation
- Document synthesis
- Meeting notes summary

**4. Domain-Specific Queries**
- Medical information lookup
- Legal document search
- Academic paper search
- Code snippet retrieval

### ❌ When You Need More

**Complex queries needing multiple retrieval passes:**
- "Compare feature X across products A, B, and C"
- Requires: Multi-query retrieval

**Low initial retrieval quality:**
- Poor embedding model for domain
- Requires: Re-ranking, query expansion

**Need high precision:**
- Critical decisions (medical, legal)
- Requires: Re-ranking, filtering, verification

**Large knowledge bases:**
- Millions of documents
- Requires: Filtering, metadata-based pre-filtering

---

## Measuring Success

### Quality Metrics

**1. Retrieval Precision**
```
Precision = Relevant Retrieved / Total Retrieved
```
Goal: > 80% for k=3

**2. Retrieval Recall**
```
Recall = Relevant Retrieved / Total Relevant in DB
```
Goal: > 60% for k=5

**3. Answer Accuracy**
```
Accuracy = Correct Answers / Total Questions
```
Goal: > 90% for in-domain queries

**4. User Satisfaction**
- Thumbs up/down on answers
- Follow-up question rate
- Query abandonment rate

### Performance Metrics

**1. End-to-End Latency**
- Goal: < 1 second for good UX
- Measure: p50, p95, p99

**2. Component Breakdown**
- Embedding time
- Search time  
- Generation time

**3. Throughput**
- Queries per second
- Concurrent users supported

---

## Summary

### What is Basic Retrieval?

**Core idea:** Retrieve relevant documents via vector search, then generate answers using LLM + context.

**Three steps:**
1. Retrieve: Vector similarity search for top-k documents
2. Assemble: Format documents into context string
3. Generate: LLM produces answer grounded in context

### Key Parameters

- **k**: Number of documents to retrieve (default: 3)
- **Similarity threshold**: Minimum score to include (default: 0.3-0.5)
- **Max context size**: Token limit for LLM (varies by model)

### Why It Works

✅ Grounds LLM in facts (reduces hallucinations)  
✅ Adds domain-specific knowledge  
✅ Enables real-time updates  
✅ Provides source attribution  

### When It's Enough

✅ Internal knowledge bases  
✅ Q&A systems  
✅ Document search  
✅ Domain-specific queries  

### When You Need Advanced Retrieval

❌ Complex multi-step queries  
❌ Poor initial retrieval quality  
❌ High precision requirements  
❌ Very large knowledge bases  

### Best Practices

1. Start with k=3
2. Set similarity threshold (0.4)
3. Monitor retrieval quality
4. Handle edge cases gracefully
5. Test with and without RAG
6. Log and measure everything

---

## Next Steps in Your RAG Journey

**You just learned:** The foundational retrieval strategy for RAG systems.

**Next concepts:**
1. **Advanced Retrieval**: Query expansion, re-ranking, hybrid search
2. **Retrieval Optimization**: Caching, batching, performance tuning
3. **Production Patterns**: Error handling, monitoring, A/B testing

**Remember:** Basic retrieval is surprisingly powerful. Start here, measure results, then optimize only if needed.

Master basic retrieval, and you've mastered the core of RAG!
