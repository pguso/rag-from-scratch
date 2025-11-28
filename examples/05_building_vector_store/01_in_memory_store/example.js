/**
 * Building In-Memory Vector Store
 *
 * Demonstrates:
 * 1) Create an in-memory vector store
 * 2) Add documents with embeddings
 * 3) Similarity search
 * 4) Metadata filtering
 * 5) Performance comparison
 * 6) CRUD (get / update / delete)
 * 7) Understanding similarity scores
 *
 * Vector DB: embedded-vector-db (beta)
 * - Namespace-based API
 * - insert / search / get / update / delete
 *
 * Prerequisites:
 * - Completed 02_generate_embeddings
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
const NS = "memory"; // single namespace for all examples

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
 * Simple tracker so we don't rely on undocumented VectorDB size APIs.
 */
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

/**
 * Simple document cache for retrieval by ID (since VectorDB doesn't have get())
 */
const documentCache = new Map();

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
        idTracker.add(doc.metadata.id);
        documentCache.set(doc.metadata.id, { id: doc.metadata.id, metadata });
    }
}

/**
 * Perform similarity search
 */
async function searchVectorStore(vectorStore, embeddingContext, query, k = 3) {
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    return await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Basic Vector Store Setup
 */
async function example1() {
    console.log(`\n${chalk.bold("Creating Vector Store...")}`);

    const vectorStore = new VectorDB({
        dim: DIM,
        maxElements: MAX_ELEMENTS,
    });

    console.log(`${chalk.green("✓")} Vector store created (${DIM} dimensions)\n`);

    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();

    console.log(`\n${chalk.bold("Adding Documents:")}`);
    console.log(`Total documents: ${documents.length}\n`);

    await OutputHelper.withSpinner(
        "Embedding and adding documents...",
        () => addDocumentsToStore(vectorStore, context, documents)
    );

    console.log(`${chalk.green("✓")} Added ${documents.length} documents to vector store\n`);

    OutputHelper.formatStats?.({
        "Namespace": NS,
        "Documents (tracked)": idTracker.count(),
        "Dimensions": DIM,
        "Storage Type": "In-Memory",
    });
}

/**
 * Example 2: Basic Similarity Search
 */
async function example2() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    const queries = [
        "How do I learn programming?",
        "Tell me about artificial intelligence",
        "Container deployment tools",
    ];

    for (const query of queries) {
        console.log(`\n${chalk.bold("Query:")} ${chalk.cyan(query)}`);

        const results = await searchVectorStore(vectorStore, context, query, 3);

        console.log(`\n${chalk.bold("Top 3 Results:")}`);
        console.log("-".repeat(70));

        results.forEach((result, index) => {
            console.log(`${chalk.bold(`${index + 1}.`)} [Score: ${chalk.green(result.similarity.toFixed(4))}]`);
            console.log(`   ${chalk.dim("ID:")} ${result.id}`);
            console.log(`   ${chalk.dim("Content:")} ${result.metadata.content.substring(0, 60)}...`);
            console.log(`   ${chalk.dim("Category:")} ${result.metadata.category}`);
            console.log();
        });
    }

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("The vector store finds semantically similar documents based on meaning, not just keywords.\n");
}

/**
 * Example 3: Filtering with Metadata
 * (Library supports metadata-aware search; here we demonstrate client-side filtering
 * to keep it explicit and easy to read.)
 */
async function example3() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    const query = "programming concepts";
    console.log(`\n${chalk.bold("Query:")} ${chalk.cyan(query)}`);

    // Search and then filter by metadata
    console.log(`\n${chalk.bold('Without Filter (All Results):')}`);
    const allResults = await searchVectorStore(vectorStore, context, query, 5);
    allResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.similarity.toFixed(4)}] ${r.metadata.category}: ${r.metadata.content.substring(0, 50)}...`);
    });

    console.log(`\n${chalk.bold('With Filter (Only "programming" category):')}`);
    const filteredResults = allResults
        .filter((r) => r.metadata.category === "programming")
        .slice(0, 5);

    filteredResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.similarity.toFixed(4)}] ${r.metadata.category}: ${r.metadata.content.substring(0, 50)}...`);
    });

    console.log(`\n${chalk.bold("💡 Key Insight:")}`);
    console.log("Metadata lets you narrow results by category, difficulty, or any custom fields.\n");
}

/**
 * Example 4: Performance Comparison
 */
async function example4() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    console.log(`\n${chalk.bold("Creating larger dataset for performance testing...")}`);
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

    console.log(`Adding ${largeDataset.length} documents...`);
    const addStart = Date.now();
    await addDocumentsToStore(vectorStore, context, largeDataset);
    const addTime = Date.now() - addStart;
    console.log(`${chalk.green("✓")} Added in ${addTime}ms\n`);

    const query = "machine learning and AI";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const kValues = [1, 5, 10, 20];

    console.log(chalk.bold("Search Performance:"));
    console.log("-".repeat(60));

    for (const k of kValues) {
        const searchStart = Date.now();
        const results = await searchVectorStore(vectorStore, context, query, k);
        const searchTime = Date.now() - searchStart;

        console.log(`k=${k.toString().padEnd(3)} → ${searchTime}ms (returned ${results.length} results)`);
    }

    console.log(`\n${chalk.bold("Statistics:")}`);
    OutputHelper.formatStats?.({
        "Namespace": NS,
        "Total Documents (tracked)": idTracker.count(),
        "Average Add Time": `${(addTime / largeDataset.length).toFixed(2)}ms per doc`,
        "Storage Type": "In-Memory (Fast)",
        "Note": "Search time includes embedding generation",
    });
}

/**
 * Example 5: Retrieving Documents by ID
 */
async function example5() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Retrieving Documents by ID:")}\n`);

    const idsToRetrieve = ["doc_1", "doc_5", "doc_10"];

    for (const id of idsToRetrieve) {
        const doc = documentCache.get(id);
        if (doc) {
            console.log(`${chalk.bold("ID:")} ${chalk.cyan(id)}`);
            console.log(`${chalk.dim("Content:")} ${doc.metadata.content}`);
            console.log(`${chalk.dim("Category:")} ${doc.metadata.category}`);
            console.log(`${chalk.dim("Difficulty:")} ${doc.metadata.difficulty || "N/A"}`);
            console.log();
        } else {
            console.log(`${chalk.yellow("• Not found:")} ${id}`);
        }
    }

    console.log(chalk.bold("💡 Use Case:"));
    console.log("After similarity search returns IDs, fetch full documents and metadata for display.\n");
}

/**
 * Example 6: Updating and Deleting Documents
 */
async function example6() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments().slice(0, 3); // fewer docs
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Initial IDs (tracked):")} ${idTracker.count()}\n`);

    // Delete a document
    console.log(`${chalk.bold("Deleting document:")} doc_2`);
    await vectorStore.delete(NS, "doc_2");
    idTracker.delete("doc_2");
    documentCache.delete("doc_2");
    console.log(`${chalk.green("✓")} Deleted`);
    console.log(`IDs (tracked): ${idTracker.count()}\n`);

    // Add a new document
    console.log(`${chalk.bold("Adding new document:")} doc_11`);
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
    console.log(`${chalk.green("✓")} Added`);
    console.log(`IDs (tracked): ${idTracker.count()}\n`);

    // Update an existing document using update()
    console.log(`${chalk.bold("Updating document:")} doc_1`);
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
    console.log(`${chalk.green("✓")} Updated`);

    // Verify changes
    const doc1 = documentCache.get("doc_1");
    console.log(`${chalk.bold("Updated document content:")}`);
    console.log(`${doc1.metadata.content}\n`);

    console.log(chalk.bold("💡 CRUD Operations:"));
    console.log("Create (insert), Read (get/search), Update (update), Delete (delete)\n");
}

/**
 * Example 7: Understanding Similarity Scores
 */
async function example7() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Understanding Similarity Scores:")}\n`);

    const testCases = [
        { query: "Python programming", description: "Very specific match" },
        { query: "coding and software", description: "Broad programming topic" },
        { query: "containers and deployment", description: "DevOps related" },
    ];

    for (const tc of testCases) {
        console.log(`${chalk.bold("Query:")} ${chalk.cyan(tc.query)}`);
        console.log(`${chalk.dim(tc.description)}\n`);

        const results = await searchVectorStore(vectorStore, context, tc.query, 5);

        results.forEach((result, index) => {
            const score = Math.max(0, Math.min(1, result.similarity)); // clamp safety
            const scoreBar = "█".repeat(Math.round(score * 30));
            const color =
                score > 0.6 ? chalk.green :
                    score > 0.4 ? chalk.yellow :
                        chalk.gray;

            console.log(`${index + 1}. ${color(score.toFixed(4))} ${color(scoreBar)}`);
            console.log(`   ${chalk.dim(result.metadata.content.substring(0, 60))}...`);
        });
        console.log();
    }

    console.log(chalk.bold("Score Interpretation:"));
    console.log(`${chalk.green("> 0.6")}  High similarity - very relevant`);
    console.log(`${chalk.yellow("0.4–0.6")} Medium similarity - somewhat relevant`);
    console.log(`${chalk.gray("< 0.4")}  Low similarity - less relevant\n`);
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllExamples() {
    console.clear();
    console.log("\n" + "=".repeat(80));
    console.log(chalk.bold("RAG from Scratch - In-Memory Vector Store (embedded-vector-db beta)"));
    console.log("=".repeat(80) + "\n");

    console.log(chalk.dim("Prerequisites:"));
    console.log(chalk.dim("• Completed 04_intro_to_embeddings"));
    console.log(chalk.dim("• npm install embedded-vector-db"));
    console.log(chalk.dim("• Model: bge-small-en-v1.5.Q8_0.gguf in models directory\n"));

    try {
        await OutputHelper.runExample("Example 1: Basic Vector Store Setup", example1);
        await OutputHelper.runExample("Example 2: Basic Similarity Search", example2);
        await OutputHelper.runExample("Example 3: Filtering with Metadata", example3);
        await OutputHelper.runExample("Example 4: Performance Comparison", example4);
        await OutputHelper.runExample("Example 5: Retrieving Documents by ID", example5);
        await OutputHelper.runExample("Example 6: Updating and Deleting Documents", example6);
        await OutputHelper.runExample("Example 7: Understanding Similarity Scores", example7);

        console.log(chalk.bold.green("\n✅ All examples completed successfully!\n"));
        console.log(chalk.bold("Key Takeaways:"));
        console.log("• In-memory vector stores are fast and easy to use");
        console.log("• Similarity search finds semantically similar documents");
        console.log("• Metadata enables filtering and organization");
        console.log("• CRUD operations work like traditional databases");
        console.log("• Similarity scores indicate relevance (0–1 range)\n");

        console.log(chalk.bold("When to Use In-Memory Vector Stores:"));
        console.log("✓ Development and prototyping");
        console.log("✓ Small datasets (< 10,000 documents)");
        console.log("✓ Fast iteration and testing");
        console.log("✓ No persistence needed between runs\n");

        console.log(chalk.bold("When to Use Persistent Vector Stores:"));
        console.log("→ Production applications");
        console.log("→ Large datasets (> 10,000 documents)");
        console.log("→ Need data persistence");
        console.log("→ Multiple concurrent users\n");

        console.log(chalk.bold("Next Steps:"));
        console.log("• 02_nearest_neighbor_search: Advanced search algorithms");
        console.log("• 03_metadata_filtering: Complex filtering strategies");

    } catch (error) {
        console.error(chalk.red("\n❌ Error:"), error?.message ?? error);
        console.error(chalk.dim("\nMake sure you have:"));
        console.error(chalk.dim("1. Installed embedded-vector-db: npm install embedded-vector-db"));
        console.error(chalk.dim("2. Completed previous examples"));
        console.error(chalk.dim("3. Model file in correct location\n"));
    }

    process.exit(0);
}

runAllExamples();
