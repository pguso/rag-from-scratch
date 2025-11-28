# Advanced Metadata Filtering - Code Walkthrough

A detailed explanation of metadata filtering strategies for vector databases, covering basic to advanced filtering patterns and performance optimization techniques.

## Overview

This example demonstrates:
- Basic single-field filtering
- Complex multi-field filtering
- Range-based filtering (dates, ratings, numerical values)
- Array/tag filtering with OR and AND logic
- Filter performance optimization (over-fetching strategy)
- Dynamic filter composition
- Complex filtering patterns and best practices

**Vector Database:** `embedded-vector-db` (beta)
- Client-side filtering after semantic search
- Flexible metadata-based filtering
- Support for complex filter conditions

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

**Same foundation as previous examples**, focusing on filtering strategies.

### Configuration Constants

```javascript
const MODEL_PATH = path.join(__dirname, "..", "..", "..", "models", "bge-small-en-v1.5.Q8_0.gguf");
const DIM = 384;
const MAX_ELEMENTS = 10000;
const NS = "metadata_filter";
```

**Key difference:** Namespace set to `"metadata_filter"` for this example set.

---

## Rich Metadata Documents

### Sample Documents with Comprehensive Metadata

```javascript
function createSampleDocuments() {
    return [
        new Document("Python is a high-level programming language...", {
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
        // ... 12 total documents with rich metadata
    ];
}
```

**What makes this rich metadata:**

**Categorical fields:**
- `category`: High-level classification (programming, ai, devops, database)
- `language`: Programming language (python, javascript, typescript)
- `difficulty`: Skill level (beginner, intermediate, advanced)

**Numerical fields:**
- `year`: Publication year (2022-2024)
- `rating`: Quality score (4.2-4.9)
- `views`: Popularity metric (1500-7000)

**Array fields:**
- `tags`: Multiple categorizations per document

**String fields:**
- `author`: Creator identification
- `topic`: Specific subject matter

**Why rich metadata matters:**
- Enables precise filtering
- Supports multiple access patterns
- Facilitates faceted search
- Powers recommendation engines

---

## Core Helper Functions

### Search with Timing

```javascript
async function searchWithTiming(vectorStore, embeddingContext, query, k = 5) {
    const startEmbed = Date.now();
    const queryEmbedding = await embeddingContext.getEmbeddingFor(query);
    const embedTime = Date.now() - startEmbed;

    const startSearch = Date.now();
    const results = await vectorStore.search(NS, Array.from(queryEmbedding.vector), k);
    const searchTime = Date.now() - startSearch;

    return { results, embedTime, searchTime };
}
```

**Purpose:** Measure performance separately for embedding vs search operations.

**Why timing matters for filtering:**
- Filtering happens after search (client-side)
- Filter time is usually negligible (< 1ms)
- Over-fetching adds minimal search time
- Embedding time dominates total time

---

## Example 1: Basic Single-Field Filtering

```javascript
async function example1() {
    // Setup...
    const query = "programming languages";
    
    // Without filter
    const allResults = await vectorStore.search(NS, queryVector, 8);
    
    // With category filter
    const filteredResults = allResults
        .filter(r => r.metadata.category === "programming")
        .slice(0, 5);
}
```

**What it demonstrates:** The simplest filtering pattern - exact match on a single field.

### How It Works

**Step 1: Semantic Search**
```javascript
const allResults = await vectorStore.search(NS, queryVector, 8);
// Returns: All semantically similar documents
```

**Step 2: Apply Filter**
```javascript
const filtered = allResults.filter(r => r.metadata.category === "programming");
// Returns: Only documents where category === "programming"
```

**Step 3: Take Top Results**
```javascript
const top5 = filtered.slice(0, 5);
// Returns: First 5 filtered results
```

### Example Output

**Without Filter:**
```
1. [0.8234] programming - Python is a high-level...
2. [0.7891] programming - JavaScript is essential...
3. [0.7543] ai - Machine learning models require...
4. [0.7234] programming - TypeScript adds static...
5. [0.6891] ai - Neural networks are inspired...
```

**With Filter (category = "programming"):**
```
1. [0.8234] programming - Python is a high-level...
2. [0.7891] programming - JavaScript is essential...
3. [0.7234] programming - TypeScript adds static...
4. [0.6543] programming - React is a popular...
5. [0.6234] programming - GraphQL is a query...
```

**Key insight:** Filtering maintains semantic ranking while narrowing to specific category.

---

## Example 2: Multi-Field Filtering

```javascript
async function example2() {
    const allResults = await vectorStore.search(NS, queryVector, 10);
    
    // Filter 1: Category only
    const filter1 = allResults.filter(r => 
        r.metadata.category === "programming"
    );
    
    // Filter 2: Category + Difficulty
    const filter2 = allResults.filter(r => 
        r.metadata.category === "programming" && 
        r.metadata.difficulty === "beginner"
    );
    
    // Filter 3: Multiple conditions
    const filter3 = allResults.filter(r => 
        r.metadata.category === "programming" && 
        r.metadata.difficulty === "intermediate" &&
        r.metadata.year === 2023
    );
}
```

**What it demonstrates:** Combining multiple metadata fields for precise filtering.

### Filter Selectivity

**Concept:** How much each filter reduces the result set.

```javascript
// Start with 10 results

// After filter 1 (category = "programming")
// → 6 results (60% selectivity)

// After filter 2 (category + difficulty)
// → 2 results (20% selectivity)

// After filter 3 (category + difficulty + year)
// → 1 result (10% selectivity)
```

**Rule:** More filters = higher precision, fewer results.

### AND Logic

**All conditions must be true:**

```javascript
r.metadata.category === "programming" &&    // Must be true
r.metadata.difficulty === "beginner" &&      // AND must be true
r.metadata.year === 2023                     // AND must be true
```

**Use case:** "I want beginner programming articles from 2023"

### Filter Order Optimization

**Least selective first (bad):**
```javascript
r.metadata.year === 2023 &&                // 50% of docs
r.metadata.category === "programming" &&   // 30% remaining
r.metadata.difficulty === "beginner"       // 10% remaining
```

**Most selective first (good):**
```javascript
r.metadata.difficulty === "beginner" &&    // 20% of docs
r.metadata.category === "programming" &&   // 10% remaining  
r.metadata.year === 2023                   // 5% remaining
```

**Why it matters:** JavaScript short-circuits evaluation - fails fast with selective filters first.

---

## Example 3: Range-Based Filtering

```javascript
async function example3() {
    const allResults = await vectorStore.search(NS, queryVector, 12);
    
    // Filter by rating range
    const highRated = allResults.filter(r => r.metadata.rating >= 4.5);
    
    // Filter by views range
    const popularDocs = allResults.filter(r => 
        r.metadata.views >= 3000 && r.metadata.views <= 5000
    );
    
    // Filter by year (recent content)
    const recentDocs = allResults.filter(r => r.metadata.year === 2024);
}
```

**What it demonstrates:** Filtering on numerical fields with range conditions.

### Range Filter Patterns

**Minimum threshold:**
```javascript
r.metadata.rating >= 4.5              // At least 4.5 stars
r.metadata.views >= 1000              // At least 1000 views
r.metadata.year >= 2023               // 2023 or newer
```

**Maximum threshold:**
```javascript
r.metadata.rating <= 4.0              // At most 4.0 stars
r.metadata.views <= 1000              // At most 1000 views
r.metadata.year <= 2022               // 2022 or older
```

**Range (min to max):**
```javascript
r.metadata.views >= 3000 && r.metadata.views <= 5000    // Between 3K-5K
r.metadata.rating >= 4.0 && r.metadata.rating <= 4.5    // Between 4.0-4.5
```

### Common Use Cases

**Quality filtering:**
```javascript
// Only high-quality content
const quality = results.filter(r => r.metadata.rating >= 4.7);
```

**Recency filtering:**
```javascript
// Only recent articles
const currentYear = new Date().getFullYear();
const recent = results.filter(r => r.metadata.year >= currentYear - 1);
```

**Popularity filtering:**
```javascript
// Trending content (many views, recent)
const trending = results.filter(r => 
    r.metadata.views >= 5000 &&
    r.metadata.year === 2024
);
```

**Price range filtering (e-commerce):**
```javascript
const affordable = results.filter(r => 
    r.metadata.price >= 10 && r.metadata.price <= 50
);
```

---

## Example 4: Array/Tag Filtering

```javascript
async function example4() {
    const allResults = await vectorStore.search(NS, queryVector, 12);
    
    // Filter by tag inclusion (OR)
    const frontendDocs = allResults.filter(r => 
        r.metadata.tags && r.metadata.tags.includes("frontend")
    );
    
    // Filter by multiple tags (OR logic)
    const aiDocs = allResults.filter(r => 
        r.metadata.tags && (
            r.metadata.tags.includes("deep-learning") || 
            r.metadata.tags.includes("nlp")
        )
    );
    
    // Filter by multiple tags (AND logic)
    const containerDocs = allResults.filter(r => 
        r.metadata.tags && 
        r.metadata.tags.includes("containers") && 
        r.metadata.tags.includes("deployment")
    );
}
```

**What it demonstrates:** Working with array fields and multi-value metadata.

### Tag Filtering Patterns

**Single tag (OR - has this tag):**
```javascript
r.metadata.tags && r.metadata.tags.includes("frontend")
// Has "frontend" tag
```

**Multiple tags (OR - has any of these tags):**
```javascript
r.metadata.tags && (
    r.metadata.tags.includes("react") ||
    r.metadata.tags.includes("vue") ||
    r.metadata.tags.includes("angular")
)
// Has "react" OR "vue" OR "angular"
```

**Multiple tags (AND - has all these tags):**
```javascript
r.metadata.tags &&
r.metadata.tags.includes("javascript") &&
r.metadata.tags.includes("frontend") &&
r.metadata.tags.includes("framework")
// Has ALL three tags
```

**Advanced: Any of multiple tags:**
```javascript
const targetTags = ["react", "vue", "angular"];
r.metadata.tags && r.metadata.tags.some(tag => targetTags.includes(tag))
// Has at least one of the target tags
```

**Advanced: All of multiple tags:**
```javascript
const requiredTags = ["javascript", "frontend"];
r.metadata.tags && requiredTags.every(tag => r.metadata.tags.includes(tag))
// Has all required tags
```

### Why Tags Matter

**Flexible categorization:**
- Single document can have multiple tags
- No rigid hierarchy
- Easy to add new tags

**Faceted search:**
```javascript
// User selects: "frontend" AND "react"
const results = allResults.filter(r =>
    r.metadata.tags?.includes("frontend") &&
    r.metadata.tags?.includes("react")
);
```

**Common tag strategies:**
- **Technology tags:** javascript, python, react
- **Topic tags:** tutorial, guide, reference
- **Difficulty tags:** beginner, advanced
- **Feature tags:** video, code-examples, interactive

---

## Example 5: Filter Performance - Over-fetching Strategy

```javascript
async function example5() {
    // Strategy 1: Fetch exactly k (risky)
    const results1 = await searchWithTiming(vectorStore, context, query, 5);
    const filtered1 = results1.filter(r => r.metadata.category === "programming");
    // May get 0-5 results
    
    // Strategy 2: Over-fetch (safe)
    const results2 = await searchWithTiming(vectorStore, context, query, 15);
    const filtered2 = results2
        .filter(r => r.metadata.category === "programming")
        .slice(0, 5);
    // Guaranteed up to 5 results
}
```

**What it demonstrates:** The over-fetching strategy for reliable filtering.

### The Problem

**Scenario:** You want 5 "programming" documents.

**Naive approach:**
```javascript
const results = await search(query, 5);
const filtered = results.filter(r => r.metadata.category === "programming");
// Might get 0, 1, 2, 3, 4, or 5 results - unpredictable!
```

**Issue:** If only 2 of 5 results match filter, you get 2 results instead of 5.

### The Solution: Over-fetch

**Calculate over-fetch multiplier:**
```
If filter selectivity = 50% (half match)
→ Fetch 2x target k

If filter selectivity = 33% (third match)
→ Fetch 3x target k

If filter selectivity = 25% (quarter match)
→ Fetch 4x target k
```

**Implementation:**
```javascript
// Want 5 results, expect 40% selectivity
const overFetchMultiplier = 1 / 0.4;  // 2.5x
const fetchK = Math.ceil(5 * overFetchMultiplier);  // 13

const results = await search(query, fetchK);
const filtered = results.filter(condition).slice(0, 5);
// Now guaranteed to get up to 5 results
```

### Performance Impact

**Timing comparison:**
```
Strategy 1 (k=5):
  Embed: 45ms
  Search: 3ms
  Total: 48ms
  Results: 2 (not enough!)

Strategy 2 (k=15):
  Embed: 45ms  (same)
  Search: 4ms  (only +1ms!)
  Total: 49ms  (+1ms)
  Results: 5 (as desired)
```

**Key insight:** Over-fetching adds minimal time (< 1ms per 10 extra results) but guarantees enough filtered results.

### Adaptive Over-fetching

**Monitor selectivity:**
```javascript
const stats = {
    totalFetched: 0,
    totalFiltered: 0,
};

function adaptiveSearch(query, targetK, filter) {
    // Calculate selectivity from history
    const selectivity = stats.totalFiltered / stats.totalFetched || 0.5;
    
    // Adjust fetch k
    const fetchK = Math.ceil(targetK / selectivity);
    
    const results = await search(query, fetchK);
    const filtered = results.filter(filter).slice(0, targetK);
    
    // Update stats
    stats.totalFetched += results.length;
    stats.totalFiltered += filtered.length;
    
    return filtered;
}
```

---

## Example 6: Dynamic Filter Composition

```javascript
async function example6() {
    // Filter builder function
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
    
    // Scenario 1: Beginner content
    const filter1 = buildFilter({ difficulty: "beginner" });
    
    // Scenario 2: High-quality AI content
    const filter2 = buildFilter({ 
        category: "ai",
        rating: { min: 4.7 }
    });
    
    // Scenario 3: Recent programming with good ratings
    const filter3 = buildFilter({ 
        category: "programming",
        year: { min: 2023 },
        rating: { min: 4.5 }
    });
}
```

**What it demonstrates:** Building reusable, composable filter functions.

### Filter Builder Pattern

**Benefits:**
1. **Reusability:** Define once, use many times
2. **Composability:** Combine filters dynamically
3. **Maintainability:** Centralized filter logic
4. **Type safety:** Can add TypeScript types

**How it works:**

**Step 1: Define conditions**
```javascript
const conditions = {
    category: "programming",
    year: { min: 2023 },
    rating: { min: 4.5 }
};
```

**Step 2: Build filter function**
```javascript
const filter = buildFilter(conditions);
// Returns: (result) => boolean
```

**Step 3: Apply to results**
```javascript
const filtered = results.filter(filter);
```

### Advanced Filter Composition

**Combining filters (AND):**
```javascript
const isRecent = buildFilter({ year: { min: 2023 } });
const isHighQuality = buildFilter({ rating: { min: 4.7 } });

const filtered = results.filter(r => isRecent(r) && isHighQuality(r));
```

**Combining filters (OR):**
```javascript
const isBeginnerProgramming = buildFilter({ 
    category: "programming",
    difficulty: "beginner"
});
const isAdvancedAI = buildFilter({ 
    category: "ai",
    difficulty: "advanced"
});

const filtered = results.filter(r => 
    isBeginnerProgramming(r) || isAdvancedAI(r)
);
```

**Negation:**
```javascript
const notAdvanced = (r) => !buildFilter({ difficulty: "advanced" })(r);
const filtered = results.filter(notAdvanced);
```

### Real-World Application

**User preference filtering:**
```javascript
function buildUserFilter(userPreferences) {
    const conditions = {};
    
    if (userPreferences.minRating) {
        conditions.rating = { min: userPreferences.minRating };
    }
    
    if (userPreferences.categories) {
        // Handle array of categories (requires OR logic)
        return (result) => 
            userPreferences.categories.includes(result.metadata.category) &&
            buildFilter(conditions)(result);
    }
    
    return buildFilter(conditions);
}

// Usage
const userFilter = buildUserFilter({
    categories: ["programming", "ai"],
    minRating: 4.5
});

const personalized = results.filter(userFilter);
```

---

## Example 7: Complex Filtering Patterns

```javascript
async function example7() {
    const allResults = await vectorStore.search(NS, queryVector, 12);
    
    // Pattern 1: Exclude filter
    const exclude = allResults.filter(r => r.metadata.difficulty !== "advanced");
    
    // Pattern 2: OR conditions
    const orFilter = allResults.filter(r => 
        r.metadata.category === "programming" || r.metadata.category === "ai"
    );
    
    // Pattern 3: Complex nested conditions
    const complex = allResults.filter(r => 
        (r.metadata.category === "ai" && r.metadata.difficulty === "advanced") ||
        (r.metadata.category === "programming" && r.metadata.difficulty === "beginner")
    );
    
    // Pattern 4: Sort filtered results
    const sorted = allResults
        .filter(r => r.metadata.category === "programming")
        .sort((a, b) => b.metadata.rating - a.metadata.rating);
    
    // Pattern 5: Similarity threshold + metadata filter
    const threshold = allResults.filter(r => 
        r.similarity > 0.3 && r.metadata.year === 2024
    );
}
```

**What it demonstrates:** Advanced filtering patterns for complex requirements.

### Pattern 1: Exclude/Negation

**Purpose:** Remove unwanted results.

```javascript
// Exclude advanced content
r.metadata.difficulty !== "advanced"

// Exclude multiple values
!["advanced", "expert"].includes(r.metadata.difficulty)

// Exclude by condition
r.metadata.views < 10000  // Exclude very popular
```

**Use cases:**
- Filter out seen content
- Remove inappropriate results
- Exclude expired/archived items

### Pattern 2: OR Conditions

**Purpose:** Match any of multiple criteria.

```javascript
// Category is programming OR ai
r.metadata.category === "programming" || r.metadata.category === "ai"

// Better: use includes()
["programming", "ai"].includes(r.metadata.category)

// Complex OR
r.metadata.rating > 4.7 || r.metadata.views > 5000
```

### Pattern 3: Nested Conditions

**Complex logic:**
```javascript
(condition1 && condition2) || (condition3 && condition4)
```

**Example:**
```javascript
// (AI AND advanced) OR (programming AND beginner)
(r.metadata.category === "ai" && r.metadata.difficulty === "advanced") ||
(r.metadata.category === "programming" && r.metadata.difficulty === "beginner")
```

**Read as:** "Give me either advanced AI content OR beginner programming content"

**Truth table:**
```
category     difficulty    Result
ai           advanced      ✓ Match
ai           beginner      ✗ No match
programming  advanced      ✗ No match
programming  beginner      ✓ Match
devops       beginner      ✗ No match
```

### Pattern 4: Post-Filter Sorting

**Purpose:** Reorder filtered results by metadata.

**Sort by single field:**
```javascript
filtered.sort((a, b) => b.metadata.rating - a.metadata.rating)  // Descending
filtered.sort((a, b) => a.metadata.year - b.metadata.year)      // Ascending
```

**Sort by multiple fields:**
```javascript
filtered.sort((a, b) => {
    // Primary: rating (descending)
    if (a.metadata.rating !== b.metadata.rating) {
        return b.metadata.rating - a.metadata.rating;
    }
    // Secondary: views (descending)
    return b.metadata.views - a.metadata.views;
});
```

**Why sort after filtering?**
- Vector search ranks by similarity
- Metadata sorting provides alternative ranking
- Useful for "best rated" or "most recent"

### Pattern 5: Combining Similarity and Metadata

**Purpose:** Quality threshold + metadata criteria.

```javascript
r.similarity > 0.5 &&              // Semantic relevance
r.metadata.rating >= 4.5 &&        // Quality
r.metadata.year === 2024           // Recency
```

**Use case:** "Recent, high-quality, relevant content"

**Example output:**
```
Without threshold:
1. [0.8234] rating: 4.2, year: 2023  ✓ Relevant but old
2. [0.6543] rating: 4.8, year: 2024  ✓ Perfect match
3. [0.4123] rating: 4.7, year: 2024  ✗ Too low similarity
4. [0.7891] rating: 4.1, year: 2024  ✗ Too low rating

With threshold (similarity > 0.5, rating >= 4.5, year = 2024):
1. [0.6543] rating: 4.8, year: 2024  ✓ Only this matches
```

---

## Filter Performance Optimization

### Optimization Strategies

**1. Put most selective filters first**
```javascript
// Bad: Least selective first
r.metadata.year >= 2020 &&              // 80% pass
r.metadata.category === "programming" && // 40% pass
r.metadata.difficulty === "expert"       // 5% pass

// Good: Most selective first
r.metadata.difficulty === "expert" &&    // 5% pass (fail fast!)
r.metadata.category === "programming" && // 3% pass
r.metadata.year >= 2020                  // 3% pass
```

**2. Cache filter functions**
```javascript
const filterCache = new Map();

function getCachedFilter(conditions) {
    const key = JSON.stringify(conditions);
    if (!filterCache.has(key)) {
        filterCache.set(key, buildFilter(conditions));
    }
    return filterCache.get(key);
}
```

**3. Monitor selectivity**
```javascript
function trackSelectivity(filter, name) {
    return (results) => {
        const before = results.length;
        const filtered = results.filter(filter);
        const after = filtered.length;
        const selectivity = after / before;
        
        console.log(`${name}: ${before} → ${after} (${(selectivity * 100).toFixed(1)}%)`);
        
        return filtered;
    };
}
```

### Performance Comparison

```javascript
// Inefficient: Multiple passes
let results = allResults;
results = results.filter(r => r.metadata.category === "programming");
results = results.filter(r => r.metadata.difficulty === "beginner");
results = results.filter(r => r.metadata.year === 2023);

// Efficient: Single pass
const results = allResults.filter(r =>
    r.metadata.category === "programming" &&
    r.metadata.difficulty === "beginner" &&
    r.metadata.year === 2023
);
```

**Why single pass is better:**
- One iteration instead of three
- Less memory allocation
- Better CPU cache utilization

---

## Common Filtering Use Cases

### 1. E-commerce Product Search

```javascript
// User filters
const filters = {
    category: "electronics",
    price: { min: 100, max: 500 },
    rating: { min: 4.0 },
    inStock: true,
    brand: ["Apple", "Samsung", "Sony"]
};

const products = searchResults.filter(r =>
    r.metadata.category === filters.category &&
    r.metadata.price >= filters.price.min &&
    r.metadata.price <= filters.price.max &&
    r.metadata.rating >= filters.rating.min &&
    r.metadata.inStock === filters.inStock &&
    filters.brand.includes(r.metadata.brand)
);
```

### 2. Content Management System

```javascript
// Editorial filters
const articles = searchResults.filter(r =>
    r.metadata.status === "published" &&
    r.metadata.publishDate >= lastWeek &&
    r.metadata.author !== "deleted-user" &&
    r.metadata.category !== "archived"
);
```

### 3. User Permissions

```javascript
// Access control
const accessible = searchResults.filter(r => {
    if (r.metadata.visibility === "public") return true;
    if (r.metadata.visibility === "private") {
        return r.metadata.owner === userId;
    }
    if (r.metadata.visibility === "team") {
        return user.teams.includes(r.metadata.teamId);
    }
    return false;
});
```

### 4. Time-based Filtering

```javascript
// Content lifecycle
const currentDate = new Date();
const active = searchResults.filter(r => {
    const startDate = new Date(r.metadata.startDate);
    const endDate = new Date(r.metadata.endDate);
    return currentDate >= startDate && currentDate <= endDate;
});
```

---

## Best Practices

### 1. Always Check Field Existence

```javascript
// ❌ Bad: Assumes field exists
r.metadata.tags.includes("react")

// ✓ Good: Check existence first
r.metadata.tags && r.metadata.tags.includes("react")

// ✓ Better: Optional chaining
r.metadata.tags?.includes("react")
```

### 2. Use Type-Safe Filters

```javascript
// Define expected metadata structure
interface Metadata {
    category: string;
    rating?: number;
    tags?: string[];
    year?: number;
}

function isValidCategory(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}
```

### 3. Document Filter Logic

```javascript
/**
 * Filters results for beginner-friendly programming content
 * - Must be category "programming"
 * - Must be difficulty "beginner"
 * - Must have rating >= 4.0
 * - Must be published in last 2 years
 */
function beginnerProgrammingFilter(result) {
    const currentYear = new Date().getFullYear();
    return (
        result.metadata.category === "programming" &&
        result.metadata.difficulty === "beginner" &&
        result.metadata.rating >= 4.0 &&
        result.metadata.year >= currentYear - 2
    );
}
```

### 4. Handle Edge Cases

```javascript
function safeFilter(result) {
    // Handle missing metadata
    if (!result.metadata) return false;
    
    // Handle undefined fields
    const rating = result.metadata.rating ?? 0;
    const tags = result.metadata.tags ?? [];
    
    // Apply filter logic
    return rating >= 4.0 && tags.length > 0;
}
```

### 5. Test Filters Independently

```javascript
describe("Category filter", () => {
    it("filters by single category", () => {
        const results = [...]; // Test data
        const filtered = results.filter(r => r.metadata.category === "programming");
        expect(filtered).toHaveLength(3);
        expect(filtered.every(r => r.metadata.category === "programming")).toBe(true);
    });
});
```

---

## Summary

### What We Built

Seven examples demonstrating:
1. ✅ Basic single-field filtering
2. ✅ Multi-field filtering with AND conditions
3. ✅ Range-based filtering for numerical fields
4. ✅ Array/tag filtering with OR and AND logic
5. ✅ Over-fetching strategy for reliable results
6. ✅ Dynamic filter composition
7. ✅ Complex filtering patterns

### Key Takeaways

- **Metadata filtering** narrows semantic search results
- **Multi-field filters** provide precision
- **Range filters** work great for dates and ratings
- **Tag filters** enable flexible categorization
- **Over-fetching** ensures enough filtered results
- **Dynamic filters** support user-driven queries
- **Filter composition** enables complex logic

### Filter Strategy Cheat Sheet

| Need | Strategy | Example |
|------|----------|---------|
| Exact match | Equality | `r.metadata.category === "ai"` |
| Multiple fields | AND conditions | `category === "ai" && difficulty === "beginner"` |
| Any of multiple | OR conditions | `category === "ai" \|\| category === "programming"` |
| Numerical range | Comparisons | `rating >= 4.5 && rating <= 5.0` |
| Has tag | Array includes | `tags?.includes("frontend")` |
| Has any tag | Array some | `tags?.some(t => ["a", "b"].includes(t))` |
| Has all tags | Multiple includes | `tags?.includes("a") && tags?.includes("b")` |
| Exclude | Negation | `difficulty !== "expert"` |
| Complex logic | Nested conditions | `(a && b) \|\| (c && d)` |

### Performance Tips

1. **Over-fetch 2-3x** when filtering (minimal cost)
2. **Put selective filters first** (fail fast)
3. **Single pass** better than multiple iterations
4. **Cache filter functions** for repeated use
5. **Monitor selectivity** to optimize over-fetch ratio

### Next Steps

- **Apply** to your domain-specific metadata
- **Scale** to larger datasets with optimization

Metadata filtering is the bridge between semantic search and precise results. Master these patterns, and you'll build powerful, user-friendly search experiences!
