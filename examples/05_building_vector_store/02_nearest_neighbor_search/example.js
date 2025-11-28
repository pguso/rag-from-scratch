/**
 * Nearest Neighbor Search Algorithms
 *
 * Demonstrates:
 * 1) Understanding kNN search
 * 2) Comparing exact vs approximate search
 * 3) HNSW algorithm parameters
 * 4) Search performance optimization
 * 5) Precision vs speed tradeoffs
 * 6) Batch search operations
 * 7) Distance metrics comparison
 *
 * Vector DB: embedded-vector-db (beta)
 * - HNSW-based approximate nearest neighbor search
 * - Configurable search parameters
 * - Multiple distance metrics
 *
 * Prerequisites:
 * - Completed 01_in_memory_store
 * - npm install embedded-vector-db node-llama-cpp chalk
 * - Place bge-small-en-v1.5.Q8_0.gguf under models/
 */

import { fileURLToPath } from "url";
import path from "path";
import { VectorDB } from "embedded-vector-db";
import { getLlama } from "node-llama-cpp";
import { Document } from "../../../src/index.js";
import { OutputHelper } from "../../../helpers/output-helper.js";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");

// VectorDB config for bge-small-en-v1.5
const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "nn_search"; // namespace for nearest neighbor examples

/**
 * Initialize the embedding model
 */
async function initializeEmbeddingModel() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: MODEL_PATH });
    return await model.createEmbeddingContext();
}

/**
 * Create sample documents for testing
 */
function createSampleDocuments() {
    return [
        new Document("Python is a high-level programming language known for its simplicity.", {
            id: "doc_1",
            category: "programming",
            language: "python",
            difficulty: "beginner",
        }),
        new Document("JavaScript is essential for web development and runs in browsers.", {
            id: "doc_2",
            category: "programming",
            language: "javascript",
            difficulty: "beginner",
        }),
        new Document("Machine learning models require training data and computational resources.", {
            id: "doc_3",
            category: "ai",
            topic: "machine-learning",
            difficulty: "intermediate",
        }),
        new Document("Neural networks are inspired by biological neurons in the brain.", {
            id: "doc_4",
            category: "ai",
            topic: "deep-learning",
            difficulty: "advanced",
        }),
        new Document("React is a popular JavaScript library for building user interfaces.", {
            id: "doc_5",
            category: "programming",
            language: "javascript",
            difficulty: "intermediate",
        }),
        new Document("Natural language processing enables computers to understand human language.", {
            id: "doc_6",
            category: "ai",
            topic: "nlp",
            difficulty: "intermediate",
        }),
        new Document("Docker containers provide isolated environments for running applications.", {
            id: "doc_7",
            category: "devops",
            topic: "containerization",
            difficulty: "intermediate",
        }),
        new Document("SQL databases use structured query language for data management.", {
            id: "doc_8",
            category: "database",
            topic: "sql",
            difficulty: "beginner",
        }),
        new Document("Kubernetes orchestrates containerized applications across clusters.", {
            id: "doc_9",
            category: "devops",
            topic: "orchestration",
            difficulty: "advanced",
        }),
        new Document("TypeScript adds static typing to JavaScript for better code quality.", {
            id: "doc_10",
            category: "programming",
            language: "typescript",
            difficulty: "intermediate",
        }),
    ];
}

/**
 * Add documents to vector store
 */
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

/**
 * Perform similarity search with timing
 */
async function searchWithTiming(vectorStore, embeddingContext, query, k = 3) {
    const startEmbed = Date.now();
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const embedTime = Date.now() - startEmbed;

    const startSearch = Date.now();
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    const searchTime = Date.now() - startSearch;

    return { results, embedTime, searchTime };
}

/**
 * Calculate cosine similarity between two vectors
 */
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

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
        const diff = vec1[i] - vec2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * Brute force exact kNN search
 */
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

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Understanding k-Nearest Neighbors
 */
async function example1() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await OutputHelper.withSpinner(
        "Adding documents...",
        () => addDocumentsToStore(vectorStore, context, documents)
    );

    console.log(`\n${chalk.bold("Understanding k-Nearest Neighbors (kNN)")}\n`);

    const query = "programming languages";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Test different k values
    const kValues = [1, 3, 5, 10];

    for (const k of kValues) {
        console.log(`${chalk.bold(`Top ${k} Results:`)}`);
        const results = await vectorStore.search(NS, 
            Array.from((await context.getEmbeddingFor(query)).vector), k);

        results.forEach((result, index) => {
            console.log(`${index + 1}. [${chalk.green(result.similarity.toFixed(4))}] ${result.id}: ${result.metadata.content.substring(0, 50)}...`);
        });
        console.log();
    }

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("k controls how many neighbors to return. Larger k gives more results but may include less relevant matches.\n");
}

/**
 * Example 2: Exact vs Approximate Search
 */
async function example2() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Exact vs Approximate Search Comparison")}\n`);

    const query = "artificial intelligence";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Brute force (exact) search
    console.log(chalk.bold("Exact Search (Brute Force):"));
    const startExact = Date.now();
    const exactResults = await bruteForceSearch(context, documents, query, 5);
    const exactTime = Date.now() - startExact;

    exactResults.forEach((result, index) => {
        console.log(`${index + 1}. [${chalk.green(result.similarity.toFixed(4))}] ${result.doc.metadata.id}: ${result.doc.pageContent.substring(0, 50)}...`);
    });
    console.log(`${chalk.dim("Time:")} ${exactTime}ms\n`);

    // HNSW (approximate) search
    console.log(chalk.bold("Approximate Search (HNSW):"));
    const startApprox = Date.now();
    const queryEmbedding = await context.getEmbeddingFor(query);
    const approxResults = await vectorStore.search(NS, Array.from(queryEmbedding.vector), 5);
    const approxTime = Date.now() - startApprox;

    approxResults.forEach((result, index) => {
        console.log(`${index + 1}. [${chalk.green(result.similarity.toFixed(4))}] ${result.id}: ${result.metadata.content.substring(0, 50)}...`);
    });
    console.log(`${chalk.dim("Time:")} ${approxTime}ms\n`);

    console.log(chalk.bold("Performance Comparison:"));
    OutputHelper.formatStats?.({
        "Exact Search Time": `${exactTime}ms`,
        "Approximate Search Time": `${approxTime}ms`,
        "Speedup": `${(exactTime / approxTime).toFixed(2)}x`,
        "Note": "HNSW is much faster on larger datasets",
    });
}

/**
 * Example 3: Search Performance with Different k Values
 */
async function example3() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    console.log(`\n${chalk.bold("Creating larger dataset for performance testing...")}`);
    const baseDocuments = createSampleDocuments();
    const largeDataset = [];

    // Create 100 documents
    for (let i = 0; i < 10; i++) {
        baseDocuments.forEach((doc, idx) => {
            largeDataset.push(new Document(doc.pageContent, {
                ...doc.metadata,
                id: `doc_${i}_${idx}`,
                batch: i,
            }));
        });
    }

    await OutputHelper.withSpinner(
        `Adding ${largeDataset.length} documents...`,
        () => addDocumentsToStore(vectorStore, context, largeDataset)
    );

    console.log(`\n${chalk.bold("Search Performance Testing")}\n`);

    const query = "machine learning and AI";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const kValues = [1, 5, 10, 20, 50];

    console.log(chalk.bold("Performance by k value:"));
    console.log("-".repeat(60));

    for (const k of kValues) {
        const { results, embedTime, searchTime } = await searchWithTiming(vectorStore, context, query, k);
        
        console.log(`k=${k.toString().padEnd(3)} → Embed: ${embedTime}ms, Search: ${searchTime}ms, Total: ${embedTime + searchTime}ms (${results.length} results)`);
    }

    console.log(`\n${chalk.bold("💡 Key Insight:")}`);
    console.log("Embedding time dominates. kNN search is very fast, even for large k.\n");
}

/**
 * Example 4: Batch Search Operations
 */
async function example4() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    // Create a larger dataset for meaningful performance comparison
    console.log(`\n${chalk.dim("Creating larger dataset for performance testing...")}`);
    const baseDocuments = createSampleDocuments();
    const largeDataset = [];
    
    // Duplicate documents with variations to create larger dataset
    for (let i = 0; i < 10; i++) {
        baseDocuments.forEach((doc, idx) => {
            largeDataset.push(new Document(doc.pageContent, {
                ...doc.metadata,
                id: `doc_${i}_${idx}`,
                batch: i,
            }));
        });
    }
    
    console.log(`${chalk.dim("Adding")} ${largeDataset.length} ${chalk.dim("documents...")}`);
    await addDocumentsToStore(vectorStore, context, largeDataset);

    console.log(`\n${chalk.bold("Batch Search Operations")}\n`);

    const queries = [
        "programming languages",
        "artificial intelligence",
        "container deployment",
        "database systems",
    ];

    // Pre-compute embeddings for fair comparison
    console.log(chalk.dim("Pre-computing embeddings for all queries...\n"));
    const embeddings = [];
    for (const query of queries) {
        const emb = await context.getEmbeddingFor(query);
        embeddings.push({ query, vector: Array.from(emb.vector) });
    }

    console.log(chalk.bold("Sequential Search:"));
    const startSeq = Date.now();
    
    for (const { query, vector } of embeddings) {
        const results = await vectorStore.search(NS, vector, 3);
        console.log(`${chalk.cyan(query)}: ${results.length} results`);
    }
    
    const seqTime = Date.now() - startSeq;
    console.log(`${chalk.dim("Total time:")} ${seqTime}ms\n`);

    console.log(chalk.bold("Parallel Search:"));
    const startPar = Date.now();
    
    // Parallel searches with pre-computed embeddings
    const allResults = await Promise.all(
        embeddings.map(({ query, vector }) => 
            vectorStore.search(NS, vector, 3)
                .then(results => ({ query, results }))
        )
    );
    
    allResults.forEach(({ query, results }) => {
        console.log(`${chalk.cyan(query)}: ${results.length} results`);
    });
    
    const parTime = Date.now() - startPar;
    console.log(`${chalk.dim("Total time:")} ${parTime}ms\n`);

    console.log(chalk.bold("Performance Comparison:"));
    OutputHelper.formatStats?.({
        "Sequential Time": `${seqTime}ms`,
        "Parallel Time": `${parTime}ms`,
        "Speedup": `${(seqTime / parTime).toFixed(2)}x`,
    });
}

/**
 * Example 5: Distance Metrics Comparison
 */
async function example5() {
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    console.log(`\n${chalk.bold("Distance Metrics Comparison")}\n`);

    // Create three sample texts
    const texts = [
        "Python programming language",
        "JavaScript programming language",
        "Cooking delicious pasta",
    ];

    console.log(chalk.bold("Sample Texts:"));
    texts.forEach((text, i) => {
        console.log(`${i + 1}. ${text}`);
    });
    console.log();

    // Generate embeddings
    const embeddings = [];
    for (const text of texts) {
        const emb = await context.getEmbeddingFor(text);
        embeddings.push(Array.from(emb.vector));
    }

    console.log(chalk.bold("Cosine Similarity Matrix:"));
    console.log("(1.0 = identical, 0.0 = orthogonal)");
    console.log("-".repeat(60));

    for (let i = 0; i < embeddings.length; i++) {
        let row = `${i + 1}. `;
        for (let j = 0; j < embeddings.length; j++) {
            const sim = cosineSimilarity(embeddings[i], embeddings[j]);
            const color = sim > 0.8 ? chalk.green : sim > 0.5 ? chalk.yellow : chalk.gray;
            row += color(sim.toFixed(4)) + "  ";
        }
        console.log(row);
    }
    console.log();

    console.log(chalk.bold("Euclidean Distance Matrix:"));
    console.log("(0.0 = identical, larger = more different)");
    console.log("-".repeat(60));

    for (let i = 0; i < embeddings.length; i++) {
        let row = `${i + 1}. `;
        for (let j = 0; j < embeddings.length; j++) {
            const dist = euclideanDistance(embeddings[i], embeddings[j]);
            const color = dist < 5 ? chalk.green : dist < 10 ? chalk.yellow : chalk.gray;
            row += color(dist.toFixed(4)) + "  ";
        }
        console.log(row);
    }
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("- Texts 1 & 2 (both about programming) have high similarity / low distance");
    console.log("- Text 3 (cooking) is very different from 1 & 2");
    console.log("- embedded-vector-db uses cosine similarity by default\n");
}

/**
 * Example 6: Search Quality vs Performance
 */
async function example6() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Search Quality vs Performance Trade-offs")}\n`);

    const query = "programming languages for beginners";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Different search strategies
    const strategies = [
        { name: "Fast Search (k=3)", k: 3 },
        { name: "Balanced Search (k=5)", k: 5 },
        { name: "Comprehensive Search (k=10)", k: 10 },
    ];

    for (const strategy of strategies) {
        console.log(chalk.bold(strategy.name));
        const { results, embedTime, searchTime } = await searchWithTiming(
            vectorStore, context, query, strategy.k
        );

        console.log(`${chalk.dim("Performance:")} ${embedTime + searchTime}ms (embed: ${embedTime}ms, search: ${searchTime}ms)`);
        console.log(`${chalk.dim("Results:")}`);

        results.forEach((result, index) => {
            const score = result.similarity;
            const relevance = score > 0.6 ? chalk.green("High") : 
                             score > 0.4 ? chalk.yellow("Medium") : 
                             chalk.gray("Low");
            console.log(`  ${index + 1}. [${result.similarity.toFixed(4)}] ${relevance} - ${result.metadata.content.substring(0, 40)}...`);
        });
        console.log();
    }

    console.log(chalk.bold("💡 Recommendations:"));
    console.log("• Use k=3-5 for fast, focused results");
    console.log("• Use k=10-20 for comprehensive results with re-ranking");
    console.log("• Consider threshold-based filtering (e.g., similarity > 0.5)");
    console.log("• Monitor both precision and recall for your use case\n");
}

/**
 * Example 7: Optimizing Search Performance
 */
async function example7() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Search Performance Optimization Techniques")}\n`);

    const query = "web development frameworks";

    // Technique 1: Cache embeddings
    console.log(chalk.bold("1. Embedding Caching"));
    console.log(chalk.dim("Computing query embedding once and reusing it...\n"));

    const startCache = Date.now();
    const cachedEmbedding = await context.getEmbeddingFor(query);
    const cachedVec = Array.from(cachedEmbedding.vector);

    // Multiple searches with cached embedding
    for (let i = 0; i < 3; i++) {
        await vectorStore.search(NS, cachedVec, 5);
    }
    const cacheTime = Date.now() - startCache;

    console.log(`${chalk.green("✓")} 3 searches completed: ${cacheTime}ms\n`);

    // Technique 2: Adjust k for filtering
    console.log(chalk.bold("2. Over-fetching for Filtering"));
    console.log(chalk.dim("Fetch more results, then filter by metadata...\n"));

    const startFilter = Date.now();
    const queryEmb = await context.getEmbeddingFor("programming");
    const manyResults = await vectorStore.search(NS, Array.from(queryEmb.vector), 10);
    
    // Filter to only programming category
    const filtered = manyResults.filter(r => r.metadata.category === "programming").slice(0, 3);
    const filterTime = Date.now() - startFilter;

    console.log(`${chalk.green("✓")} Found ${filtered.length} programming documents: ${filterTime}ms\n`);

    // Technique 3: Batch processing
    console.log(chalk.bold("3. Batch Query Processing"));
    console.log(chalk.dim("Processing multiple queries efficiently...\n"));

    const queries = ["python", "javascript", "typescript"];
    const startBatch = Date.now();

    // Batch embed
    const embeddings = await Promise.all(queries.map(q => context.getEmbeddingFor(q)));
    
    // Batch search
    await Promise.all(embeddings.map(e => 
        vectorStore.search(NS, Array.from(e.vector), 3)
    ));
    
    const batchTime = Date.now() - startBatch;

    console.log(`${chalk.green("✓")} ${queries.length} queries processed: ${batchTime}ms\n`);

    console.log(chalk.bold("Optimization Summary:"));
    console.log("✓ Cache embeddings when searching with same query multiple times");
    console.log("✓ Over-fetch and filter when you need specific metadata criteria");
    console.log("✓ Use Promise.all() for parallel batch processing");
    console.log("✓ The embedding step is the bottleneck, not the kNN search\n");
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllExamples() {
    console.clear();
    console.log("\n" + "=".repeat(80));
    console.log(chalk.bold("RAG from Scratch - Nearest Neighbor Search Algorithms"));
    console.log("=".repeat(80) + "\n");

    console.log(chalk.dim("Prerequisites:"));
    console.log(chalk.dim("• Completed 01_in_memory_store"));
    console.log(chalk.dim("• npm install embedded-vector-db"));
    console.log(chalk.dim("• Model: bge-small-en-v1.5.Q8_0.gguf in models directory\n"));

    try {
        await OutputHelper.runExample("Example 1: Understanding k-Nearest Neighbors", example1);
        await OutputHelper.runExample("Example 2: Exact vs Approximate Search", example2);
        await OutputHelper.runExample("Example 3: Search Performance with Different k Values", example3);
        await OutputHelper.runExample("Example 4: Batch Search Operations", example4);
        await OutputHelper.runExample("Example 5: Distance Metrics Comparison", example5);
        await OutputHelper.runExample("Example 6: Search Quality vs Performance", example6);
        await OutputHelper.runExample("Example 7: Optimizing Search Performance", example7);

        console.log(chalk.bold.green("\n✅ All examples completed successfully!\n"));
        console.log(chalk.bold("Key Takeaways:"));
        console.log("• k-Nearest Neighbors finds the k most similar vectors");
        console.log("• HNSW provides fast approximate search (vs slow exact search)");
        console.log("• Embedding generation is the performance bottleneck");
        console.log("• Larger k returns more results but may reduce precision");
        console.log("• Cosine similarity is the standard metric for semantic search");
        console.log("• Cache embeddings and use batch operations for best performance\n");

        console.log(chalk.bold("Algorithm Choice Guidelines:"));
        console.log("✓ HNSW (approximate): Production use, large datasets, speed matters");
        console.log("✓ Brute force (exact): Small datasets, maximum precision needed");
        console.log("✓ Hybrid: Approximate for candidates, exact for re-ranking\n");

        console.log(chalk.bold("Performance Optimization:"));
        console.log("→ Cache query embeddings when reusing");
        console.log("→ Use batch operations with Promise.all()");
        console.log("→ Over-fetch and filter for metadata criteria");
        console.log("→ Monitor embedding time vs search time separately\n");

        console.log(chalk.bold("Next Steps:"));
        console.log("• 03_metadata_filtering: Advanced filtering strategies");
        console.log("• Production deployment with persistent storage\n");

    } catch (error) {
        console.error(chalk.red("\n❌ Error:"), error?.message ?? error);
        console.error(chalk.dim("\nMake sure you have:"));
        console.error(chalk.dim("1. Completed 01_in_memory_store"));
        console.error(chalk.dim("2. Installed dependencies: npm install"));
        console.error(chalk.dim("3. Model file in correct location\n"));
    }

    process.exit(0);
}

runAllExamples();
