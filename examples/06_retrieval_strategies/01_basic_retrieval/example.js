/**
 * Basic Retrieval Strategy for RAG
 *
 * Demonstrates:
 * 1) Basic RAG pipeline: retrieve + generate
 * 2) Top-k retrieval from vector store
 * 3) Context assembly for LLM
 * 4) Answer generation with retrieved context
 * 5) Handling queries with no relevant results
 * 6) Comparing answers with and without retrieval
 * 7) Understanding retrieval quality impact
 *
 * This is the foundational retrieval strategy that combines:
 * - Vector similarity search (retrieval)
 * - LLM generation with context (augmentation)
 *
 * Prerequisites:
 * - Completed 04_intro_to_embeddings and 05_building_vector_store
 * - npm install embedded-vector-db node-llama-cpp chalk
 * - Place bge-small-en-v1.5.Q8_0.gguf and Qwen3-1.7B-Q8_0.gguf under models/
 *
 * Download the qwen model here: https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/blob/main/Qwen3-1.7B-Q8_0.gguf
 */

import { fileURLToPath } from "url";
import path from "path";
import { VectorDB } from "embedded-vector-db";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { Document } from "../../../src/index.js";
import { OutputHelper } from "../../../helpers/output-helper.js";
import chalk from "chalk";

// Increase max listeners to avoid warnings when running multiple examples
process.setMaxListeners(20);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMBEDDING_MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");
const LLM_MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "hf_Qwen_Qwen3-1.7B.Q8_0.gguf");

// VectorDB config
const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "basic_retrieval";

/**
 * Initialize the embedding model
 */
async function initializeEmbeddingModel() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: EMBEDDING_MODEL_PATH });
    return await model.createEmbeddingContext();
}

/**
 * Initialize the LLM for generation
 */
async function initializeLLM() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: LLM_MODEL_PATH });
    const context = await model.createContext();
    return new LlamaChatSession({ contextSequence: context.getSequence() });
}

/**
 * Create knowledge base documents
 */
function createKnowledgeBase() {
    return [
        new Document("Python is a high-level programming language known for its simplicity and readability. It's widely used in data science, web development, and automation.", {
            id: "doc_1",
            category: "programming",
            topic: "python",
        }),
        new Document("JavaScript is the primary language for web browsers and enables interactive web pages. It's also used server-side with Node.js.", {
            id: "doc_2",
            category: "programming",
            topic: "javascript",
        }),
        new Document("Machine learning is a subset of artificial intelligence that enables systems to learn from data without explicit programming. It uses algorithms to identify patterns.", {
            id: "doc_3",
            category: "ai",
            topic: "machine-learning",
        }),
        new Document("Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes organized in layers.", {
            id: "doc_4",
            category: "ai",
            topic: "neural-networks",
        }),
        new Document("React is a JavaScript library for building user interfaces, developed by Facebook. It uses a component-based architecture and virtual DOM.", {
            id: "doc_5",
            category: "programming",
            topic: "react",
        }),
        new Document("Natural language processing (NLP) is a branch of AI that helps computers understand and process human language. It powers chatbots, translation, and sentiment analysis.", {
            id: "doc_6",
            category: "ai",
            topic: "nlp",
        }),
        new Document("Docker is a containerization platform that packages applications with their dependencies. It ensures consistent behavior across different environments.", {
            id: "doc_7",
            category: "devops",
            topic: "docker",
        }),
        new Document("Git is a distributed version control system for tracking changes in source code. It enables collaboration among developers and maintains project history.", {
            id: "doc_8",
            category: "tools",
            topic: "git",
        }),
        new Document("SQL (Structured Query Language) is used for managing relational databases. It supports operations like SELECT, INSERT, UPDATE, and DELETE.", {
            id: "doc_9",
            category: "database",
            topic: "sql",
        }),
        new Document("REST APIs use HTTP methods to enable communication between systems. They follow stateless architecture and use JSON or XML for data exchange.", {
            id: "doc_10",
            category: "web",
            topic: "rest-api",
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
 * Retrieve relevant documents from vector store
 */
async function retrieveDocuments(vectorStore, embeddingContext, query, k = 3) {
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    return results;
}

/**
 * Build context string from retrieved documents
 */
function buildContext(retrievedDocs) {
    if (retrievedDocs.length === 0) {
        return "";
    }
    
    const contextParts = retrievedDocs.map((doc, idx) => 
        `[${idx + 1}] ${doc.metadata.content}`
    );
    
    return contextParts.join("\n\n");
}

/**
 * Generate answer using LLM with retrieved context
 */
async function generateAnswer(chatSession, query, context) {
    if (!context || context.trim().length === 0) {
        const prompt = `Question: ${query}\n\nYou don't have any relevant information to answer this question. Please say so politely.`;
        const response = await chatSession.prompt(prompt, { maxTokens: 200 });
        return response.trim();
    }
    
    const prompt = `You are a helpful assistant. Use the following context to answer the question. If the context doesn't contain relevant information, say so.

Context:
${context}

Question: ${query}

Answer:`;
    
    const response = await chatSession.prompt(prompt, { maxTokens: 300 });
    return response.trim();
}

/**
 * Complete RAG pipeline
 */
async function ragPipeline(vectorStore, embeddingContext, chatSession, query, k = 3) {
    // Step 1: Retrieve relevant documents
    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, k);
    
    // Step 2: Build context from retrieved documents
    const context = buildContext(retrievedDocs);
    
    // Step 3: Generate answer using LLM with context
    const answer = await generateAnswer(chatSession, query, context);
    
    return { retrievedDocs, context, answer };
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Basic RAG Pipeline
 */
async function example1() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await OutputHelper.withSpinner(
        "Adding documents to vector store...",
        () => addDocumentsToStore(vectorStore, embeddingContext, documents)
    );

    console.log(`\n${chalk.bold("Basic RAG Pipeline")}\n`);
    console.log(`Knowledge base: ${documents.length} documents\n`);

    const query = "What is Python?";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const { retrievedDocs, context, answer } = await ragPipeline(
        vectorStore, embeddingContext, chatSession, query, 3
    );

    console.log(`${chalk.bold("Step 1 - Retrieved Documents:")} (k=3)`);
    retrievedDocs.forEach((doc, idx) => {
        console.log(`${idx + 1}. [${chalk.green(doc.similarity.toFixed(4))}] ${doc.metadata.content.substring(0, 60)}...`);
    });

    console.log(`\n${chalk.bold("Step 2 - Context Assembled:")}`);
    console.log(chalk.dim(context.substring(0, 200) + "...\n"));

    console.log(`${chalk.bold("Step 3 - Generated Answer:")}`);
    console.log(chalk.yellow(answer));
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("RAG = Retrieval (vector search) + Augmented Generation (LLM with context)\n");
}

/**
 * Example 2: Varying k (Number of Retrieved Documents)
 */
async function example2() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Impact of k Parameter on Retrieval")}\n`);

    const query = "Tell me about artificial intelligence";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const kValues = [1, 3, 5];

    for (const k of kValues) {
        console.log(chalk.bold(`\nk=${k}:`));
        console.log("─".repeat(70));
        
        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, k
        );

        console.log(`${chalk.bold("Retrieved:")}`);
        retrievedDocs.forEach((doc, idx) => {
            console.log(`  ${idx + 1}. [${doc.similarity.toFixed(4)}] ${doc.metadata.topic}`);
        });

        console.log(`\n${chalk.bold("Answer:")}`);
        const displayAnswer = answer.length > 150 ? answer.substring(0, 150) + "..." : answer;
        console.log(chalk.dim(displayAnswer));
    }

    console.log(`\n\n${chalk.bold("💡 Key Insight:")}`);
    console.log("k=1: Fast but limited context");
    console.log("k=3: Balanced (most common choice)");
    console.log("k=5: More context but may include less relevant docs\n");
}

/**
 * Example 3: Retrieval Quality Impact
 */
async function example3() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Retrieval Quality Impact")}\n`);

    const queries = [
        { query: "What is machine learning?", expected: "high relevance" },
        { query: "How does Docker work?", expected: "medium relevance" },
        { query: "What's the weather today?", expected: "no relevance" },
    ];

    for (const { query, expected } of queries) {
        console.log(`\n${chalk.bold("Query:")} ${chalk.cyan(query)}`);
        console.log(`${chalk.dim(`Expected: ${expected}`)}\n`);

        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, 3
        );

        console.log(`${chalk.bold("Top Retrieved Document:")}`);
        if (retrievedDocs.length > 0) {
            const top = retrievedDocs[0];
            console.log(`[${chalk.green(top.similarity.toFixed(4))}] ${top.metadata.content.substring(0, 80)}...`);
        } else {
            console.log(chalk.red("No documents retrieved"));
        }

        console.log(`\n${chalk.bold("Answer:")}`);
        const displayAnswer = answer.length > 150 ? answer.substring(0, 150) + "..." : answer;
        console.log(chalk.yellow(displayAnswer));
        console.log();
    }

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("High similarity scores (>0.7) → Relevant context → Accurate answers");
    console.log("Low similarity scores (<0.3) → Poor context → LLM should acknowledge limitations\n");
}

/**
 * Example 4: With vs Without Retrieval
 */
async function example4() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Comparing: With vs Without Retrieval")}\n`);

    const query = "What is React used for?";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Without retrieval (LLM only)
    console.log(chalk.bold("WITHOUT Retrieval (LLM only):"));
    console.log("─".repeat(70));
    const promptNoRAG = `You are a helpful assistant. Answer the following question based on your knowledge:\n\nQuestion: ${query}\n\nAnswer:`;
    const answerNoRAG = await chatSession.prompt(promptNoRAG, { maxTokens: 300 });
    console.log(chalk.dim(answerNoRAG.trim()));
    console.log();

    // With retrieval (RAG)
    console.log(chalk.bold("WITH Retrieval (RAG):"));
    console.log("─".repeat(70));
    const { retrievedDocs, answer } = await ragPipeline(
        vectorStore, embeddingContext, chatSession, query, 3
    );
    
    console.log(`${chalk.bold("Retrieved:")} ${retrievedDocs.length} documents`);
    retrievedDocs.slice(0, 2).forEach((doc, idx) => {
        console.log(`  ${idx + 1}. [${doc.similarity.toFixed(4)}] ${doc.metadata.topic}`);
    });
    
    console.log(`\n${chalk.bold("Answer:")}`);
    console.log(chalk.yellow(answer));
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("RAG grounds answers in your knowledge base, ensuring accuracy and reducing hallucinations.\n");
}

/**
 * Example 5: Filtering Low-Quality Retrievals
 */
async function example5() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Filtering Low-Quality Retrievals")}\n`);

    const query = "What's the capital of Australia?";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Retrieve documents
    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, 5);

    console.log(`${chalk.bold("All Retrieved Documents:")}`);
    retrievedDocs.forEach((doc, idx) => {
        const color = doc.similarity > 0.5 ? chalk.green : 
                      doc.similarity > 0.3 ? chalk.yellow : chalk.red;
        console.log(`${idx + 1}. [${color(doc.similarity.toFixed(4))}] ${doc.metadata.topic}`);
    });

    // Apply similarity threshold
    const threshold = 0.3;
    const filtered = retrievedDocs.filter(doc => doc.similarity > threshold);
    
    console.log(`\n${chalk.bold(`After filtering (threshold > ${threshold}):`)} ${filtered.length} documents`);
    
    const context = buildContext(filtered);
    const answer = await generateAnswer(chatSession, query, context);

    console.log(`\n${chalk.bold("Answer:")}`);
    console.log(chalk.yellow(answer));
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Set a similarity threshold (e.g., 0.3-0.5) to filter out irrelevant documents.");
    console.log("This prevents noise from degrading answer quality.\n");
}

/**
 * Example 6: Context Window Management
 */
async function example6() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Context Window Management")}\n`);

    const query = "programming languages";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const retrievedDocs = await retrieveDocuments(vectorStore, embeddingContext, query, 5);

    // Show context sizes
    for (let k = 1; k <= 5; k++) {
        const context = buildContext(retrievedDocs.slice(0, k));
        const tokens = Math.ceil(context.length / 4); // Rough estimate: 1 token ≈ 4 chars
        
        console.log(`${chalk.bold(`k=${k}:`)} ${context.length} chars (~${tokens} tokens)`);
    }

    console.log(`\n${chalk.bold("💡 Key Insight:")}`);
    console.log("Balance context size with LLM limits:");
    console.log("• Small models (1B-3B): k=2-3 documents");
    console.log("• Medium models (7B-13B): k=3-5 documents");
    console.log("• Large models (30B+): k=5-10 documents");
    console.log("Always leave room for the question and answer!\n");
}

/**
 * Example 7: Multiple Queries Batch Processing
 */
async function example7() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const embeddingContext = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );
    
    const chatSession = await OutputHelper.withSpinner(
        "Loading LLM...",
        () => initializeLLM()
    );

    const documents = createKnowledgeBase();
    await addDocumentsToStore(vectorStore, embeddingContext, documents);

    console.log(`\n${chalk.bold("Batch Processing Multiple Queries")}\n`);

    const queries = [
        "What is Python?",
        "Explain neural networks",
        "What is Docker?",
    ];

    console.log(`${chalk.bold("Processing")} ${queries.length} queries...\n`);

    const startTime = Date.now();

    for (const query of queries) {
        console.log(`${chalk.bold("Q:")} ${chalk.cyan(query)}`);
        
        const { retrievedDocs, answer } = await ragPipeline(
            vectorStore, embeddingContext, chatSession, query, 2
        );

        console.log(`${chalk.bold("A:")} ${answer.substring(0, 100)}...`);
        console.log(`${chalk.dim(`Retrieved: ${retrievedDocs.length} docs, Top score: ${retrievedDocs[0]?.similarity.toFixed(4)}`)}`);
        console.log();
    }

    const totalTime = Date.now() - startTime;
    console.log(`${chalk.bold("Total time:")} ${totalTime}ms (avg: ${Math.round(totalTime / queries.length)}ms per query)\n`);

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("For batch processing, consider caching embeddings and parallelizing retrieval steps.\n");
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllExamples() {
    console.clear();
    console.log("\n" + "=".repeat(80));
    console.log(chalk.bold("RAG from Scratch - Basic Retrieval Strategy"));
    console.log("=".repeat(80) + "\n");

    console.log(chalk.dim("Prerequisites:"));
    console.log(chalk.dim("• Completed 04_intro_to_embeddings and 05_building_vector_store"));
    console.log(chalk.dim("• npm install embedded-vector-db node-llama-cpp"));
    console.log(chalk.dim("• Models: bge-small-en-v1.5.Q8_0.gguf and hf_Qwen_Qwen3-1.7B.Q8_0.gguf\n"));

    try {
        await OutputHelper.runExample("Example 1: Basic RAG Pipeline", example1);
        await OutputHelper.runExample("Example 2: Varying k Parameter", example2);
        await OutputHelper.runExample("Example 3: Retrieval Quality Impact", example3);
        await OutputHelper.runExample("Example 4: With vs Without Retrieval", example4);
        await OutputHelper.runExample("Example 5: Filtering Low-Quality Retrievals", example5);
        await OutputHelper.runExample("Example 6: Context Window Management", example6);
        await OutputHelper.runExample("Example 7: Batch Processing", example7);

        console.log(chalk.bold.green("\n✅ All examples completed successfully!\n"));
        
        console.log(chalk.bold("Key Takeaways:"));
        console.log("• RAG = Retrieval (vector search) + Augmented Generation (LLM)");
        console.log("• k parameter controls number of retrieved documents (typical: 3-5)");
        console.log("• Similarity scores indicate retrieval quality");
        console.log("• Filter low-similarity results to reduce noise");
        console.log("• Balance context size with LLM capabilities");
        console.log("• RAG grounds answers in your knowledge base\n");

        console.log(chalk.bold("Best Practices:"));
        console.log("✓ Use k=3 as default starting point");
        console.log("✓ Set similarity threshold (0.3-0.5) to filter noise");
        console.log("✓ Monitor context size relative to model limits");
        console.log("✓ Handle cases with no relevant documents gracefully");
        console.log("✓ Compare with/without RAG to verify improvement\n");

        console.log(chalk.bold("Next Steps:"));
        console.log("• 02_advanced_retrieval: Query expansion, re-ranking, hybrid search");
        console.log("• 03_retrieval_optimization: Caching, batching, performance tuning\n");

    } catch (error) {
        console.error(chalk.red("\n❌ Error:"), error?.message ?? error);
        console.error(chalk.dim("\nMake sure you have:"));
        console.error(chalk.dim("1. Installed dependencies: npm install"));
        console.error(chalk.dim("2. Both model files in correct location"));
        console.error(chalk.dim("3. Completed previous examples\n"));
    }

    process.exit(0);
}

runAllExamples();
