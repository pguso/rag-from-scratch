// Minimal RAG simulation with naive keyword search
// No embeddings, no vectors - just the core concept

// Our "knowledge base" - a collection of facts
const knowledge = [
    "Underwhelming Spatula is a kitchen tool that redefines expectations by fusing whimsy with functionality.",
    "Lisa Melton wrote Dubious Parenting Tips.",
    "The Almost-Perfect Investment Guide is 210 pages long.",
    "Quantum computing uses qubits instead of classical bits.",
    "The capital of France is Paris."
];

// Step 1: RETRIEVE - Find relevant documents using simple keyword matching
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
        .filter(item => item.score > 0)  // Only return documents with matches
        .map(item => item.doc);
}

// Step 2: GENERATE - Create answer using retrieved context (simulated)
function generateAnswer(query, context) {
    if (context.length === 0) {
        return "I don't have enough information to answer that question.";
    }
    
    // In a real RAG system, this would call an LLM with the context
    // For now, we just return the most relevant context
    return `Based on the available information:\n\n${context.join('\n\n')}`;
}

// Step 3: RAG Pipeline - Combine retrieval and generation
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

// Example queries
console.log('='.repeat(50));
console.log('   MINIMAL RAG WITH NAIVE KEYWORD SEARCH');
console.log('='.repeat(50));

ragPipeline("What is Underwhelming Spatula?");
ragPipeline("Who wrote Dubious Parenting Tips?");
ragPipeline("How many pages is the investment guide?");
ragPipeline("Tell me about quantum computing");
ragPipeline("What is the weather today?");  // No relevant context
