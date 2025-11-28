# How RAG Works - Code Walkthrough

A step-by-step explanation of a minimal RAG (Retrieval-Augmented Generation) system using naive keyword search.

## Overview

This example demonstrates the **core concept of RAG** in the simplest way possible:
- No embeddings or vector databases
- No external APIs or models
- Just 3 functions that show how retrieval + generation work together

The goal: See how RAG works in <70 lines of code before diving into vectors and embeddings.

---

## The Knowledge Base

```javascript
const knowledge = [
    "Underwhelming Spatula is a kitchen tool that redefines expectations by fusing whimsy with functionality.",
    "Lisa Melton wrote Dubious Parenting Tips.",
    "The Almost-Perfect Investment Guide is 210 pages long.",
    "Quantum computing uses qubits instead of classical bits.",
    "The capital of France is Paris."
];
```

**What it is:** A simple array of strings representing your "database" of facts.

**In a real RAG system:** This would be:
- Thousands of document chunks
- Stored in a vector database
- Each with an embedding (numerical representation)

**For this example:** We keep it simple to focus on the retrieval + generation pattern.

---

## Step 1: Retrieval (Naive Keyword Search)

```javascript
function naiveKeywordSearch(query, documents, topK = 2) {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Score each document by counting keyword matches
    const scored = documents.map(doc => {
        const docWords = doc.toLowerCase().split(/\s+/);
        const matches = queryWords.filter(word => docWords.includes(word)).length;
        return { doc, score: matches };
    });
    
    // Sort by score (highest first) and return top K
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(item => item.score > 0)
        .map(item => item.doc);
}
```

### How it works:

1. **Parse the query**
   ```javascript
   const queryWords = query.toLowerCase().split(/\s+/);
   ```
   - Converts query to lowercase
   - Splits into individual words
   - Example: "What is Underwhelming Spatula?" → `["what", "is", "underwhelming", "spatula?"]`

2. **Score each document**
   ```javascript
   const scored = documents.map(doc => {
       const docWords = doc.toLowerCase().split(/\s+/);
       const matches = queryWords.filter(word => docWords.includes(word)).length;
       return { doc, score: matches };
   });
   ```
   - For each document, split into words
   - Count how many query words appear in the document
   - Higher score = more keyword matches

3. **Rank and filter**
   ```javascript
   return scored
       .sort((a, b) => b.score - a.score)  // Sort by score (descending)
       .slice(0, topK)                      // Take top K results
       .filter(item => item.score > 0)     // Remove documents with no matches
       .map(item => item.doc);              // Return just the documents
   ```

### Example:

**Query:** "What is Underwhelming Spatula?"

**Scoring:**
- Doc 1: "Underwhelming Spatula is a kitchen..." → Score: 3 ("underwhelming", "spatula", "is")
- Doc 2: "Lisa Melton wrote..." → Score: 0
- Doc 3: "The Almost-Perfect Investment..." → Score: 1 ("is")
- Doc 4: "Quantum computing uses..." → Score: 0
- Doc 5: "The capital of France..." → Score: 1 ("is")

**Result:** Returns Doc 1 (highest score)

### Limitations of naive keyword search:

❌ **No semantic understanding**
- Query: "Who is the author of Dubious Parenting Tips?"
- Doesn't match "wrote" with "author"

❌ **Word order doesn't matter**
- "dog bites man" scores the same as "man bites dog"

❌ **No synonym handling**
- "automobile" won't match "car"

**Why we use it here:** It's simple and demonstrates the core concept of retrieval without requiring embeddings or ML models.

**What's better:** Embeddings + cosine similarity (covered in later examples)

---

## Step 2: Generation (Simulated)

```javascript
function generateAnswer(query, context) {
    if (context.length === 0) {
        return "I don't have enough information to answer that question.";
    }
    
    // In a real RAG system, this would call an LLM with the context
    // For now, we just return the most relevant context
    return `Based on the available information:\n\n${context.join('\n\n')}`;
}
```

### How it works:

1. **Check if context exists**
   ```javascript
   if (context.length === 0) {
       return "I don't have enough information to answer that question.";
   }
   ```
   - If retrieval found nothing, admit we don't know
   - Prevents hallucination (making up answers)

2. **Return the context**
   ```javascript
   return `Based on the available information:\n\n${context.join('\n\n')}`;
   ```
   - Formats the retrieved documents as the answer
   - In a real system, this would be fed to an LLM

### In a real RAG system:

```javascript
function generateAnswer(query, context) {
    const prompt = `
        Answer the question based on the following context:
        
        Context:
        ${context.join('\n\n')}
        
        Question: ${query}
        
        Answer:
    `;
    
    return await callLLM(prompt);  // e.g., OpenAI, Claude, or local LLM
}
```

**The LLM would:**
- Read the retrieved context
- Understand the question
- Synthesize an answer using the provided information
- Stay grounded (not make things up)

**For this example:** We skip the LLM to keep it simple and dependency-free.

---

## Step 3: RAG Pipeline

```javascript
function ragPipeline(query) {
    console.log(`\n📝 Question: ${query}`);
    console.log(`─────────────────────────────────────`);
    
    // Retrieve relevant documents
    const relevantDocs = naiveKeywordSearch(query, knowledge);
    console.log(`\n🔍 Retrieved ${relevantDocs.length} relevant document(s)`);
    
    // Generate answer using retrieved context
    const answer = generateAnswer(query, relevantDocs);
    console.log(`\n💡 Answer:\n${answer}\n`);
    
    return answer;
}
```

### The RAG Pattern:

**Input:** User query

↓

**Step 1 - Retrieve:** Find relevant documents from knowledge base

↓

**Step 2 - Generate:** Use retrieved context to create answer

↓

**Output:** Grounded answer (based on real data)

### Why this matters:

**Without RAG (LLM alone):**
```
User: "What is Underwhelming Spatula?"
LLM: "I'm not sure, that sounds like a made-up product..."
```

**With RAG:**
```
User: "What is Underwhelming Spatula?"
System: [Retrieves relevant document]
LLM: "Underwhelming Spatula is a kitchen tool that redefines expectations..."
```

### Benefits:
- ✅ **Factual answers:** Based on your data, not the LLM's training
- ✅ **Up-to-date:** Add new documents without retraining
- ✅ **Transparent:** You can see what documents were used
- ✅ **Domain-specific:** Works with proprietary/specialized knowledge

---

## Example Outputs

### Query 1: "What is Underwhelming Spatula?"
```
📝 Question: What is Underwhelming Spatula?
─────────────────────────────────────

🔍 Retrieved 1 relevant document(s)

💡 Answer:
Based on the available information:

Underwhelming Spatula is a kitchen tool that redefines expectations by fusing whimsy with functionality.
```

**Why it works:** Keywords "Underwhelming" and "Spatula" directly match the document.

---

### Query 2: "Who wrote Dubious Parenting Tips?"
```
📝 Question: Who wrote Dubious Parenting Tips?
─────────────────────────────────────

🔍 Retrieved 1 relevant document(s)

💡 Answer:
Based on the available information:

Lisa Melton wrote Dubious Parenting Tips.
```

**Why it works:** Keywords "Dubious Parenting Tips" match exactly.

---

### Query 3: "What is the weather today?"
```
📝 Question: What is the weather today?
─────────────────────────────────────

🔍 Retrieved 0 relevant document(s)

💡 Answer:
I don't have enough information to answer that question.
```

**Why it fails:** No documents in our knowledge base mention "weather" or "today".

**This is correct behavior:** The system doesn't hallucinate an answer.

---

## Key Concepts

### 1. Retrieval ≠ Search Engines

**Traditional search:**
- Returns links to documents
- User reads the documents themselves

**RAG retrieval:**
- Returns document content
- System uses content to generate an answer

---

### 2. Context Window Matters

**The problem:** LLMs have limited context windows (e.g., 4K-128K tokens)

**Why retrieval helps:**
- You might have millions of documents
- LLM can only read a few at a time
- Retrieval finds the **most relevant** ones

**Example:**
```
Knowledge base: 10,000 documents (10M tokens)
LLM context: 8K tokens
Retrieval: Finds top 5 most relevant (2K tokens)
Result: LLM gets exactly what it needs
```

---

### 3. The RAG Formula

```
Answer = LLM(Query + Retrieved_Context)
```

**Without context:**
```
Answer = LLM(Query)  ← May hallucinate
```

**With RAG:**
```
Answer = LLM(Query + Retrieved_Context)  ← Grounded in facts
```

---

## What's Next?

This example shows the **concept**, but real-world RAG needs:

1. **Better retrieval** → Embeddings + vector search (next examples)
2. **Real generation** → Integrate an LLM (OpenAI, Claude, local models)
3. **Chunking strategy** → Split large documents into searchable pieces
4. **Ranking/reranking** → Improve retrieval quality
5. **Prompt engineering** → Tell the LLM how to use context effectively

Each of these is covered in the later examples in this repository.

---

## Running the Example

```bash
node examples/00_how_rag_works/example.js
```

**No dependencies required!** This example uses only Node.js built-ins.

---

## Summary

This 69-line example demonstrates:
- ✅ The core RAG pattern (retrieve + generate)
- ✅ How retrieval finds relevant information
- ✅ How context improves answer quality
- ✅ Why RAG prevents hallucination

**Next step:** Learn what LLMs are and how to use node-llama-cpp to run LLMs locally the core of every RAG system.
