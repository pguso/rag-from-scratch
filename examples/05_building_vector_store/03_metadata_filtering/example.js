/**
 * Advanced Metadata Filtering
 *
 * Demonstrates:
 * 1) Basic metadata filtering
 * 2) Complex multi-field filtering
 * 3) Range-based filtering
 * 4) Combining filters with search
 * 5) Filter performance optimization
 * 6) Dynamic filter composition
 * 7) Best practices for filtering
 *
 * Vector DB: embedded-vector-db (beta)
 * - Metadata-aware search
 * - Client-side and server-side filtering
 * - Flexible filter strategies
 *
 * Prerequisites:
 * - Completed 01_in_memory_store and 02_nearest_neighbor_search
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
const NS = "metadata_filter"; // namespace for metadata filtering examples

/**
 * Initialize the embedding model
 */
async function initializeEmbeddingModel() {
    const llama = await getLlama({ logLevel: "error" });
    const model = await llama.loadModel({ modelPath: MODEL_PATH });
    return await model.createEmbeddingContext();
}

/**
 * Create sample documents with rich metadata
 */
function createSampleDocuments() {
    return [
        new Document("Python is a high-level programming language known for its simplicity.", {
            id: "doc_1",
            category: "programming",
            language: "python",
            difficulty: "beginner",
            year: 2023,
            rating: 4.5,
            tags: ["backend", "scripting", "data-science"],
            author: "Alice",
            views: 1500,
        }),
        new Document("JavaScript is essential for web development and runs in browsers.", {
            id: "doc_2",
            category: "programming",
            language: "javascript",
            difficulty: "beginner",
            year: 2023,
            rating: 4.3,
            tags: ["frontend", "web", "full-stack"],
            author: "Bob",
            views: 2000,
        }),
        new Document("Machine learning models require training data and computational resources.", {
            id: "doc_3",
            category: "ai",
            topic: "machine-learning",
            difficulty: "intermediate",
            year: 2024,
            rating: 4.7,
            tags: ["ml", "data-science", "algorithms"],
            author: "Charlie",
            views: 3500,
        }),
        new Document("Neural networks are inspired by biological neurons in the brain.", {
            id: "doc_4",
            category: "ai",
            topic: "deep-learning",
            difficulty: "advanced",
            year: 2024,
            rating: 4.8,
            tags: ["deep-learning", "neural-networks", "research"],
            author: "Diana",
            views: 4000,
        }),
        new Document("React is a popular JavaScript library for building user interfaces.", {
            id: "doc_5",
            category: "programming",
            language: "javascript",
            difficulty: "intermediate",
            year: 2023,
            rating: 4.6,
            tags: ["frontend", "react", "ui"],
            author: "Eve",
            views: 5000,
        }),
        new Document("Natural language processing enables computers to understand human language.", {
            id: "doc_6",
            category: "ai",
            topic: "nlp",
            difficulty: "intermediate",
            year: 2024,
            rating: 4.5,
            tags: ["nlp", "text", "linguistics"],
            author: "Frank",
            views: 2800,
        }),
        new Document("Docker containers provide isolated environments for running applications.", {
            id: "doc_7",
            category: "devops",
            topic: "containerization",
            difficulty: "intermediate",
            year: 2023,
            rating: 4.4,
            tags: ["docker", "containers", "deployment"],
            author: "Grace",
            views: 3200,
        }),
        new Document("SQL databases use structured query language for data management.", {
            id: "doc_8",
            category: "database",
            topic: "sql",
            difficulty: "beginner",
            year: 2022,
            rating: 4.2,
            tags: ["sql", "database", "relational"],
            author: "Henry",
            views: 1800,
        }),
        new Document("Kubernetes orchestrates containerized applications across clusters.", {
            id: "doc_9",
            category: "devops",
            topic: "orchestration",
            difficulty: "advanced",
            year: 2024,
            rating: 4.9,
            tags: ["kubernetes", "k8s", "containers"],
            author: "Ivy",
            views: 6000,
        }),
        new Document("TypeScript adds static typing to JavaScript for better code quality.", {
            id: "doc_10",
            category: "programming",
            language: "typescript",
            difficulty: "intermediate",
            year: 2023,
            rating: 4.7,
            tags: ["typescript", "types", "javascript"],
            author: "Jack",
            views: 4500,
        }),
        new Document("GraphQL is a query language for APIs and a runtime for executing queries.", {
            id: "doc_11",
            category: "programming",
            topic: "api",
            difficulty: "intermediate",
            year: 2023,
            rating: 4.4,
            tags: ["graphql", "api", "web"],
            author: "Kate",
            views: 2500,
        }),
        new Document("Transformer architecture revolutionized natural language processing.", {
            id: "doc_12",
            category: "ai",
            topic: "deep-learning",
            difficulty: "advanced",
            year: 2024,
            rating: 4.9,
            tags: ["transformers", "nlp", "attention"],
            author: "Leo",
            views: 7000,
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
 * Search with timing
 */
async function searchWithTiming(vectorStore, embeddingContext, query, k = 5) {
    const startEmbed = Date.now();
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const embedTime = Date.now() - startEmbed;

    const startSearch = Date.now();
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    const searchTime = Date.now() - startSearch;

    return { results, embedTime, searchTime };
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Basic Single-Field Filtering
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

    console.log(`\n${chalk.bold("Basic Single-Field Filtering")}\n`);

    const query = "programming languages";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Without filter
    console.log(chalk.bold("Without Filter (All Results):"));
    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 8);

    allResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.similarity.toFixed(4)}] ${chalk.yellow(r.metadata.category)} - ${r.metadata.content.substring(0, 50)}...`);
    });
    console.log();

    // With category filter
    console.log(chalk.bold('With Filter (category = "programming"):'));
    const filteredResults = allResults
        .filter(r => r.metadata.category === "programming")
        .slice(0, 5);

    filteredResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.similarity.toFixed(4)}] ${chalk.green(r.metadata.category)} - ${r.metadata.content.substring(0, 50)}...`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Metadata filtering narrows results to specific categories while maintaining semantic relevance.\n");
}

/**
 * Example 2: Multi-Field Filtering
 */
async function example2() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Multi-Field Filtering")}\n`);

    const query = "web development";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 10);

    // Filter 1: Category only
    console.log(chalk.bold('Filter: category = "programming"'));
    const filter1 = allResults.filter(r => r.metadata.category === "programming");
    console.log(`Results: ${filter1.length}`);
    filter1.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category} (${r.metadata.difficulty})`);
    });
    console.log();

    // Filter 2: Category + Difficulty
    console.log(chalk.bold('Filter: category = "programming" AND difficulty = "beginner"'));
    const filter2 = allResults.filter(r => 
        r.metadata.category === "programming" && 
        r.metadata.difficulty === "beginner"
    );
    console.log(`Results: ${filter2.length}`);
    filter2.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.language} (${r.metadata.difficulty})`);
    });
    console.log();

    // Filter 3: Multiple conditions
    console.log(chalk.bold('Filter: category = "programming" AND difficulty = "intermediate" AND year = 2023'));
    const filter3 = allResults.filter(r => 
        r.metadata.category === "programming" && 
        r.metadata.difficulty === "intermediate" &&
        r.metadata.year === 2023
    );
    console.log(`Results: ${filter3.length}`);
    filter3.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.language || r.metadata.topic} (year: ${r.metadata.year})`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Combine multiple metadata fields for precise filtering. More filters = fewer results.\n");
}

/**
 * Example 3: Range-Based Filtering
 */
async function example3() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Range-Based Filtering")}\n`);

    const query = "technology articles";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 12);

    // Filter by rating range
    console.log(chalk.bold("Filter: Rating >= 4.5"));
    const highRated = allResults.filter(r => r.metadata.rating >= 4.5);
    console.log(`Results: ${highRated.length}`);
    highRated.slice(0, 5).forEach((r, i) => {
        const stars = "⭐".repeat(Math.round(r.metadata.rating));
        console.log(`  ${i + 1}. ${r.id} - Rating: ${r.metadata.rating} ${stars}`);
    });
    console.log();

    // Filter by views range
    console.log(chalk.bold("Filter: Views between 3000 and 5000"));
    const popularDocs = allResults.filter(r => 
        r.metadata.views >= 3000 && r.metadata.views <= 5000
    );
    console.log(`Results: ${popularDocs.length}`);
    popularDocs.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - Views: ${r.metadata.views.toLocaleString()}`);
    });
    console.log();

    // Filter by year (recent content)
    console.log(chalk.bold("Filter: Year = 2024 (Recent Content)"));
    const recentDocs = allResults.filter(r => r.metadata.year === 2024);
    console.log(`Results: ${recentDocs.length}`);
    recentDocs.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category} (${r.metadata.year})`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Range filters work with numerical metadata (ratings, dates, counts) for time-based or quality filtering.\n");
}

/**
 * Example 4: Array/Tag Filtering
 */
async function example4() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Array/Tag Filtering")}\n`);

    const query = "software development";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 12);

    // Filter by tag inclusion
    console.log(chalk.bold('Filter: Has tag "frontend"'));
    const frontendDocs = allResults.filter(r => 
        r.metadata.tags && r.metadata.tags.includes("frontend")
    );
    console.log(`Results: ${frontendDocs.length}`);
    frontendDocs.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - Tags: [${r.metadata.tags.join(", ")}]`);
    });
    console.log();

    // Filter by multiple tags (OR logic)
    console.log(chalk.bold('Filter: Has tag "deep-learning" OR "nlp"'));
    const aiDocs = allResults.filter(r => 
        r.metadata.tags && (
            r.metadata.tags.includes("deep-learning") || 
            r.metadata.tags.includes("nlp")
        )
    );
    console.log(`Results: ${aiDocs.length}`);
    aiDocs.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - Tags: [${r.metadata.tags.join(", ")}]`);
    });
    console.log();

    // Filter by multiple tags (AND logic)
    console.log(chalk.bold('Filter: Has BOTH "containers" AND "deployment"'));
    const containerDocs = allResults.filter(r => 
        r.metadata.tags && 
        r.metadata.tags.includes("containers") && 
        r.metadata.tags.includes("deployment")
    );
    console.log(`Results: ${containerDocs.length}`);
    containerDocs.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - Tags: [${r.metadata.tags.join(", ")}]`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Tags enable flexible categorization. Use includes() for OR logic, combine for AND logic.\n");
}

/**
 * Example 5: Filter Performance - Over-fetching Strategy
 */
async function example5() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Filter Performance - Over-fetching Strategy")}\n`);

    const query = "tutorials";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    // Strategy 1: Fetch exactly k (may not get enough after filtering)
    console.log(chalk.bold("Strategy 1: Fetch k=5, then filter"));
    const { results: results1, embedTime: embed1, searchTime: search1 } = 
        await searchWithTiming(vectorStore, context, query, 5);
    
    const filtered1 = results1.filter(r => r.metadata.category === "programming");
    console.log(`Fetched: 5, After filter: ${filtered1.length}`);
    console.log(`Time: ${embed1 + search1}ms\n`);

    // Strategy 2: Over-fetch to ensure enough filtered results
    console.log(chalk.bold("Strategy 2: Fetch k=15, filter, take 5"));
    const { results: results2, embedTime: embed2, searchTime: search2 } = 
        await searchWithTiming(vectorStore, context, query, 15);
    
    const filtered2 = results2
        .filter(r => r.metadata.category === "programming")
        .slice(0, 5);
    console.log(`Fetched: 15, After filter: ${filtered2.length}`);
    console.log(`Time: ${embed2 + search2}ms\n`);

    // Show results
    console.log(chalk.bold("Final Results (Strategy 2):"));
    filtered2.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.similarity.toFixed(4)}] ${r.id} - ${r.metadata.category}`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Over-fetch by 2-3x when filtering to ensure you get enough results.");
    console.log("The extra search time is minimal compared to embedding time.\n");
}

/**
 * Example 6: Dynamic Filter Composition
 */
async function example6() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Dynamic Filter Composition")}\n`);

    const query = "technology";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 12);

    /**
     * Filter builder function
     */
    function buildFilter(conditions) {
        return (result) => {
            for (const [field, value] of Object.entries(conditions)) {
                if (value === undefined) continue;
                
                if (typeof value === 'object' && value !== null) {
                    // Handle range filters
                    if (value.min !== undefined && result.metadata[field] < value.min) return false;
                    if (value.max !== undefined && result.metadata[field] > value.max) return false;
                } else {
                    // Handle exact match
                    if (result.metadata[field] !== value) return false;
                }
            }
            return true;
        };
    }

    // Scenario 1: User wants beginner content
    console.log(chalk.bold("Scenario 1: Beginner content only"));
    const filter1 = buildFilter({ difficulty: "beginner" });
    const results1 = allResults.filter(filter1);
    console.log(`Results: ${results1.length}`);
    results1.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category} (${r.metadata.difficulty})`);
    });
    console.log();

    // Scenario 2: User wants high-quality AI content
    console.log(chalk.bold("Scenario 2: AI content with rating >= 4.7"));
    const filter2 = buildFilter({ 
        category: "ai",
        rating: { min: 4.7 }
    });
    const results2 = allResults.filter(filter2);
    console.log(`Results: ${results2.length}`);
    results2.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.topic} (rating: ${r.metadata.rating})`);
    });
    console.log();

    // Scenario 3: User wants recent programming content with good ratings
    console.log(chalk.bold("Scenario 3: Recent programming (2023-2024), rating >= 4.5"));
    const filter3 = buildFilter({ 
        category: "programming",
        year: { min: 2023 },
        rating: { min: 4.5 }
    });
    const results3 = allResults.filter(filter3);
    console.log(`Results: ${results3.length}`);
    results3.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.language || r.metadata.topic} (${r.metadata.year}, rating: ${r.metadata.rating})`);
    });
    console.log();

    console.log(chalk.bold("💡 Key Insight:"));
    console.log("Build reusable filter functions to compose complex queries dynamically.\n");
}

/**
 * Example 7: Complex Filtering Patterns
 */
async function example7() {
    const vectorStore = new VectorDB({ dim: DIM, maxElements: MAX_ELEMENTS });
    const context = await OutputHelper.withSpinner(
        "Loading embedding model...",
        () => initializeEmbeddingModel()
    );

    const documents = createSampleDocuments();
    await addDocumentsToStore(vectorStore, context, documents);

    console.log(`\n${chalk.bold("Complex Filtering Patterns")}\n`);

    const query = "learning resources";
    console.log(`${chalk.bold("Query:")} ${chalk.cyan(query)}\n`);

    const allResults = await vectorStore.search(NS, 
        Array.from((await context.getEmbeddingFor(query)).vector), 12);

    // Pattern 1: Exclude filter
    console.log(chalk.bold('Pattern 1: Exclude "advanced" difficulty'));
    const exclude = allResults.filter(r => r.metadata.difficulty !== "advanced");
    console.log(`Results: ${exclude.length}`);
    exclude.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category} (${r.metadata.difficulty})`);
    });
    console.log();

    // Pattern 2: OR conditions
    console.log(chalk.bold('Pattern 2: category = "programming" OR "ai"'));
    const orFilter = allResults.filter(r => 
        r.metadata.category === "programming" || r.metadata.category === "ai"
    );
    console.log(`Results: ${orFilter.length}`);
    orFilter.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category}`);
    });
    console.log();

    // Pattern 3: Complex nested conditions
    console.log(chalk.bold('Pattern 3: (AI AND advanced) OR (programming AND beginner)'));
    const complex = allResults.filter(r => 
        (r.metadata.category === "ai" && r.metadata.difficulty === "advanced") ||
        (r.metadata.category === "programming" && r.metadata.difficulty === "beginner")
    );
    console.log(`Results: ${complex.length}`);
    complex.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - ${r.metadata.category} (${r.metadata.difficulty})`);
    });
    console.log();

    // Pattern 4: Sort filtered results
    console.log(chalk.bold("Pattern 4: Programming docs, sorted by rating"));
    const sorted = allResults
        .filter(r => r.metadata.category === "programming")
        .sort((a, b) => b.metadata.rating - a.metadata.rating)
        .slice(0, 5);
    console.log(`Results: ${sorted.length}`);
    sorted.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} - Rating: ${r.metadata.rating} (${r.metadata.language || r.metadata.topic})`);
    });
    console.log();

    // Pattern 5: Similarity threshold + metadata filter
    console.log(chalk.bold("Pattern 5: Similarity > 0.3 AND year = 2024"));
    const threshold = allResults.filter(r => 
        r.similarity > 0.3 && r.metadata.year === 2024
    );
    console.log(`Results: ${threshold.length}`);
    threshold.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.similarity.toFixed(4)}] ${r.id} - ${r.metadata.category}`);
    });
    console.log();

    console.log(chalk.bold("Best Practices:"));
    console.log("✓ Use exclude filters to remove unwanted results");
    console.log("✓ Combine OR conditions for broader matches");
    console.log("✓ Sort filtered results by metadata fields");
    console.log("✓ Combine similarity thresholds with metadata filters");
    console.log("✓ Keep filter logic readable and maintainable\n");
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllExamples() {
    console.clear();
    console.log("\n" + "=".repeat(80));
    console.log(chalk.bold("RAG from Scratch - Advanced Metadata Filtering"));
    console.log("=".repeat(80) + "\n");

    console.log(chalk.dim("Prerequisites:"));
    console.log(chalk.dim("• Completed 01_in_memory_store and 02_nearest_neighbor_search"));
    console.log(chalk.dim("• npm install embedded-vector-db"));
    console.log(chalk.dim("• Model: bge-small-en-v1.5.Q8_0.gguf in models directory\n"));

    try {
        await OutputHelper.runExample("Example 1: Basic Single-Field Filtering", example1);
        await OutputHelper.runExample("Example 2: Multi-Field Filtering", example2);
        await OutputHelper.runExample("Example 3: Range-Based Filtering", example3);
        await OutputHelper.runExample("Example 4: Array/Tag Filtering", example4);
        await OutputHelper.runExample("Example 5: Filter Performance - Over-fetching Strategy", example5);
        await OutputHelper.runExample("Example 6: Dynamic Filter Composition", example6);
        await OutputHelper.runExample("Example 7: Complex Filtering Patterns", example7);

        console.log(chalk.bold.green("\n✅ All examples completed successfully!\n"));
        console.log(chalk.bold("Key Takeaways:"));
        console.log("• Metadata filtering narrows semantic search results");
        console.log("• Combine multiple fields for precise filtering");
        console.log("• Range filters work great for numerical data");
        console.log("• Tags enable flexible multi-category classification");
        console.log("• Over-fetch 2-3x when filtering to ensure enough results");
        console.log("• Build reusable filter functions for complex queries");
        console.log("• Combine similarity thresholds with metadata filters\n");

        console.log(chalk.bold("Filter Strategy Guidelines:"));
        console.log("✓ Single field: Direct equality check");
        console.log("✓ Multiple fields: AND conditions for precision");
        console.log("✓ Ranges: Use for dates, ratings, counts");
        console.log("✓ Tags: Use includes() for flexible categorization");
        console.log("✓ Complex: Compose OR/AND conditions as needed\n");

        console.log(chalk.bold("Performance Tips:"));
        console.log("→ Over-fetch before filtering (2-3x target k)");
        console.log("→ Put most selective filters first");
        console.log("→ Cache common filter functions");
        console.log("→ Monitor filter selectivity ratios");
        console.log("→ Consider server-side filtering for very large datasets\n");

        console.log(chalk.bold("Common Use Cases:"));
        console.log("• Filter by category/type (documents, products, users)");
        console.log("• Filter by date range (recent, archived, historical)");
        console.log("• Filter by quality metrics (rating, views, engagement)");
        console.log("• Filter by user permissions (public, private, team)");
        console.log("• Filter by status (published, draft, archived)\n");

        console.log(chalk.bold("Next Steps:"));
        console.log("• Apply to your specific domain and metadata schema");
        console.log("• Scale to larger datasets with distributed vector DBs\n");

    } catch (error) {
        console.error(chalk.red("\n❌ Error:"), error?.message ?? error);
        console.error(chalk.dim("\nMake sure you have:"));
        console.error(chalk.dim("1. Completed previous examples"));
        console.error(chalk.dim("2. Installed dependencies: npm install"));
        console.error(chalk.dim("3. Model file in correct location\n"));
    }

    process.exit(0);
}

runAllExamples();
