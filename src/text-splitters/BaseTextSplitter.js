import {Document} from "../utils/Document.js";

export class BaseTextSplitter {
    constructor({
                    chunkSize = 1000,
                    chunkOverlap = 200,
                    lengthFunction = t => t.length,
                    keepSeparator = false
                } = {}) {
        if (chunkOverlap >= chunkSize) {
            throw new Error('chunkOverlap must be less than chunkSize');
        }

        Object.assign(this, {chunkSize, chunkOverlap, lengthFunction, keepSeparator});
    }

    /**
     * Splits a single text string, must be implemented by subclasses.
     */
    splitText() {
        throw new Error('splitText() must be implemented by subclass');
    }

    /**
     * Splits a list of Document objects into chunked Documents.
     */
    async splitDocuments(documents) {
        const chunks = [];
        for (const doc of documents) {
            chunks.push(...await this.createDocuments([doc.pageContent], [doc.metadata]));
        }
        return chunks;
    }

    /**
     * Converts raw text segments into Document objects with metadata.
     */
    async createDocuments(texts, metadatas = []) {
        const documents = [];
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            const metadata = metadatas[i] || {};
            const chunks = this.splitText(text);

            for (let j = 0; j < chunks.length; j++) {
                documents.push(
                    new Document(chunks[j], {
                        ...metadata,
                        chunk: j,
                        totalChunks: chunks.length
                    })
                );
            }
        }
        return documents;
    }

    /**
     * Merges text splits into chunks with overlap.
     */
    mergeSplits(splits, separator) {
        const chunks = [];
        let current = [];
        let length = 0;

        for (const split of splits) {
            const splitLength = this.lengthFunction(split);
            const extraLength = current.length ? separator.length : 0;

            // finalize current chunk if it exceeds size
            if (length + splitLength + extraLength > this.chunkSize) {
                if (current.length) {
                    chunks.push(this.joinSplits(current, separator));
                }

                // maintain overlap
                while (length > this.chunkOverlap && current.length) {
                    length -= this.lengthFunction(current.shift()) + separator.length;
                }
            }

            current.push(split);
            length += splitLength + (current.length > 1 ? separator.length : 0);
        }

        if (current.length) {
            chunks.push(this.joinSplits(current, separator));
        }

        return chunks.filter(Boolean);
    }

    /**
     * Joins text splits with a separator and trims whitespace.
     */
    joinSplits(splits, separator) {
        const text = splits.join(separator).trim();
        return text || null;
    }
}