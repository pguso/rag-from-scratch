# Generate Embeddings - Code Walkthrough

A step-by-step guide to efficiently generating, storing, and managing embeddings for RAG systems.

## Overview

This example teaches you how to scale from 10 documents (01_text_similarity_basics) to thousands of documents by introducing persistence, batch processing, and incremental updates.

---

## Core Functions

### 1. Initialize Embedding Model
```javascript
async function initializeEmbeddingModel() {
    const llama = await getLlama({
        logLevel: 'error'
    });
    const model = await llama.loadModel({
        modelPath: MODEL_PATH
    });
    return await model.createEmbeddingContext();
}
```

**What it does:** Loads the BGE embedding model and creates a context for generating embeddings.

**Key point:** This is expensive (takes ~1-2 seconds), so we only do it once per example.

---

### 2. Generate Embeddings with Progress
```javascript
async function generateEmbeddings(context, documents, onProgress = null) {
    const embeddings = [];
    let processed = 0;

    for (const document of documents) {
        const embedding = await context.getEmbeddingFor(document.pageContent);
        
        embeddings.push({
            id: document.metadata.id || `doc_${processed}`,
            content: document.pageContent,
            metadata: document.metadata,
            embedding: Array.from(embedding.vector), // Convert to plain array
            timestamp: Date.now()
        });

        processed++;
        if (onProgress) {
            onProgress(processed, documents.length); // Report progress
        }
    }

    return embeddings;
}
```

**What it does:**
1. Loops through documents
2. Generates embedding for each document's text
3. Stores embedding + metadata together
4. Reports progress (optional callback)

**Key insight:** `Array.from(embedding.vector)` converts the native embedding object to a plain JavaScript array that can be saved to JSON.

---

### 3. Save Embeddings (JSON)
```javascript
async function saveEmbeddingsJSON(embeddings, filename) {
    await fs.mkdir(STORAGE_DIR, {recursive: true});
    const filepath = path.join(STORAGE_DIR, filename);

    const data = {
        version: '1.0',
        model: 'bge-small-en-v1.5',
        dimensions: (embeddings.length > 0 && embeddings[0]?.embedding)
            ? embeddings[0].embedding.length
            : 384,
        count: embeddings.length,
        created: new Date().toISOString(),
        embeddings: embeddings
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    
    const stats = await fs.stat(filepath);
    return {filepath, size: stats.size};
}
```

**What it does:**
1. Creates storage directory if needed
2. Wraps embeddings in metadata (version, model, dimensions, count, timestamp)
3. Saves as formatted JSON
4. Returns file path and size

**Why metadata?** When you load embeddings later, you'll know:
- Which model generated them
- When they were created
- If they're compatible with your current setup

---

### 4. Load Embeddings
```javascript
async function loadExistingEmbeddings(filename) {
    try {
        const embeddings = await loadEmbeddingsJSON(filename);
        const embeddingMap = new Map();

        for (const item of embeddings) {
            embeddingMap.set(item.id, item);
        }

        return embeddingMap;
    } catch (error) {
        return new Map(); // No existing embeddings
    }
}
```

**What it does:** Reads JSON file and extracts the embeddings array.

**Performance:** Loading is 100-1000x faster than regenerating embeddings!

---

### 5. Incremental Updates
```javascript
async function incrementalEmbedding(context, newDocuments, existingFilename) {
    const existingMap = await loadExistingEmbeddings(existingFilename);

    // Filter out documents that already have embeddings
    const documentsToEmbed = newDocuments.filter(doc => {
        const id = doc.metadata.id || doc.pageContent.substring(0, 50);
        return !existingMap.has(id);
    });

    console.log(`Existing embeddings: ${existingMap.size}`);
    console.log(`New documents to embed: ${documentsToEmbed.length}`);
    console.log(`Skipped (already embedded): ${newDocuments.length - documentsToEmbed.length}`);

    if (documentsToEmbed.length === 0) {
        console.log(chalk.green('All documents already embedded!'));
        return Array.from(existingMap.values());
    }

    // Generate embeddings only for new documents
    const newEmbeddings = await generateEmbeddings(
        context,
        documentsToEmbed,
        (current, total) => {
            process.stdout.write(`\rEmbedding: ${current}/${total}`);
        }
    );
    console.log(); // New line

    // Merge with existing
    return [
        ...Array.from(existingMap.values()),
        ...newEmbeddings
    ];
}
```

**What it does:**
1. Loads existing embeddings into a Map (for fast lookup)
2. Checks each new document against existing IDs
3. Only embeds documents that don't exist yet
4. Merges new embeddings with existing ones

**Why this matters:** If you have 1000 embedded documents and add 10 new ones, you only embed 10 (not 1010).

---

## Example Breakdown

### Example 1: Batch Processing

**Purpose:** Show efficient embedding generation for 100 documents.

**Key Code:**
```javascript
const embeddings = await generateEmbeddings(
    context,
    documents,
    (current, total) => {
        const percent = ((current / total) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${current}/${total} (${percent}%)`);
    }
);
```

**Output:**
```
Progress: 100/100 (100.0%)
✓ Completed in 0.49s
Throughput: 204.1 docs/sec
```

**Lesson:** You can process hundreds of documents in seconds with batch processing.

---

### Example 2: Save and Load

**Purpose:** Demonstrate the massive speedup from caching embeddings.

**The Test:**
1. Generate embeddings: ~0.75s
2. Save to disk: ~5ms
3. Load from disk: ~2ms

**Result:** Loading is **373x faster** than generating!

**Code Pattern:**
```javascript
// Generate once
const embeddings = await generateEmbeddings(context, documents);
await saveEmbeddingsJSON(embeddings, 'embeddings.json');

// Load many times (fast!)
const loadedEmbeddings = await loadEmbeddingsJSON('embeddings.json');
```

**Real-world usage:**
```javascript
// On first run or when documents change
if (!fs.existsSync('embeddings.json')) {
    embeddings = await generateEmbeddings(context, documents);
    await saveEmbeddingsJSON(embeddings, 'embeddings.json');
}

// On subsequent runs (normal case)
embeddings = await loadEmbeddingsJSON('embeddings.json');
```

---

### Example 3: Incremental Updates

**Purpose:** Only embed new documents, skip existing ones.

**Scenario:**
- Start with 30 documents (embedded and saved)
- Add 20 new documents + 5 duplicates
- Expected: Only embed the 20 new ones

**Output:**
```
Existing embeddings: 30
New documents to embed: 20
Skipped (already embedded): 5
✓ Update Time: 0.08s
```

**Why it matters:** In production, your document collection grows over time. Incremental updates save hours of re-computation.

---

### Example 4: Storage Format Comparison

**Purpose:** Compare JSON format performance.

**Results:**
- **JSON**: 1.10 MB, 5ms load time
- Human-readable
- Easy to debug
- Good for development

**When to use JSON:**
- Development and debugging
- Small datasets (<1000 documents)
- When you need to inspect embeddings
- Portability across systems

---

### Example 5: Preparing for Vector Stores

**Purpose:** Structure embeddings for database import.

**Vector Store Format:**
```javascript
{
  "id": "doc_0",
  "vector": [0.023, -0.156, 0.891, ...], // 384 numbers
  "metadata": {
    "content": "Introduction to machine learning...",
    "source": "ml_guide.pdf",
    "page": 1,
    "chunk": 0,
    "timestamp": 1234567890
  }
}
```

**Why this structure?**
- `id`: Unique identifier for retrieval
- `vector`: The embedding (what gets searched)
- `metadata`: Everything else (displayed in results)

**Next step:** Import this into LanceDB, Qdrant, Chroma, or Milvus.

---

### Example 6: Real-World Pipeline

**Purpose:** Complete workflow from PDF to stored embeddings.

**The Pipeline:**
```
1. Load PDF
   ↓ PDFLoader
   [22 pages of text]

2. Split into chunks
   ↓ RecursiveCharacterTextSplitter()
   [334 text chunks]

3. Generate embeddings
   ↓ generateEmbeddings() (first 20 chunks for demo)
   [20 embedding vectors]

4. Save to disk
   ↓ saveEmbeddingsJSON()
   [pdf_embeddings.json - 1070 KB]
```

**Code:**
```javascript
const loader = new PDFLoader(pdfUrl, {splitPages: true});
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({chunkSize: 500, chunkOverlap: 50});
const chunks = await splitter.splitDocuments(docs);
const embeddings = await generateEmbeddings(context, chunks.slice(0, 20));
await saveEmbeddingsJSON(embeddings, 'pdf_embeddings.json');
```

---

## Key Patterns

### Pattern 1: Check Before Generate
```javascript
// Smart caching pattern
let embeddings;
try {
    embeddings = await loadEmbeddingsJSON('embeddings.json');
    console.log('Loaded cached embeddings');
} catch {
    embeddings = await generateEmbeddings(context, documents);
    await saveEmbeddingsJSON(embeddings, 'embeddings.json');
    console.log('Generated and cached embeddings');
}
```

### Pattern 2: Progress Tracking
```javascript
await generateEmbeddings(context, documents, (current, total) => {
    process.stdout.write(`\rProgress: ${current}/${total}`);
});
console.log(); // New line after progress
```

### Pattern 3: Metadata Enrichment
```javascript
// Add metadata during embedding generation
embeddings.push({
    id: document.metadata.id,
    content: document.pageContent,
    metadata: {
        ...document.metadata,
        embedded_at: Date.now(),
        model: 'bge-small-en-v1.5',
        chunk_size: document.pageContent.length
    },
    embedding: Array.from(embedding.vector)
});
```

---

## Performance Numbers

From the examples:

| Operation | Time | Notes |
|-----------|------|-------|
| Generate 100 embeddings | 0.49s | ~5ms per document |
| Save to JSON | 5ms | Negligible overhead |
| Load from JSON | 2ms | 373x faster than generating |
| Incremental update (20 new) | 0.08s | Skip existing embeddings |

**Throughput:** ~200 documents/second on CPU

**Storage:** ~11KB per document (JSON format)

---

## Common Mistakes to Avoid

### ❌ Re-embedding everything
```javascript
// BAD: Regenerate all embeddings every time
const embeddings = await generateEmbeddings(context, allDocuments);
```

### ✅ Use caching
```javascript
// GOOD: Load if available, generate if needed
const embeddings = await loadEmbeddingsJSON('cache.json')
    .catch(() => generateEmbeddings(context, allDocuments));
```

### ❌ Not tracking document IDs
```javascript
// BAD: No way to know what's embedded
embeddings.push({ embedding: [...] });
```

### ✅ Always include identifiers
```javascript
// GOOD: Track source and content
embeddings.push({
    id: doc.metadata.id,
    content: doc.pageContent,
    embedding: [...]
});
```

### ❌ Forgetting metadata
```javascript
// BAD: Just the vector
{ embedding: [...] }
```

### ✅ Include context
```javascript
// GOOD: Vector + metadata for retrieval
{
    embedding: [...],
    metadata: {
        source: 'document.pdf',
        page: 5,
        timestamp: Date.now()
    }
}
```