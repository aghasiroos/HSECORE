/**
 * HSECORE Text Chunker Engine
 * Recursively splits Persian and English regulatory and technical documents
 * into semantically cohesive chunks with context overlap.
 */

export interface TextChunk {
  index: number;
  text: string;
  tokenCount: number;
  metadata?: {
    heading?: string;
    startChar: number;
    endChar: number;
  };
}

export interface ChunkerOptions {
  maxChunkSize?: number; // Target characters per chunk (default: 650)
  overlapSize?: number;  // Overlap characters (default: 100)
}

export class TextChunker {
  private sentenceDelimiters = [
    '\n\n',
    '\n',
    '؛',
    '. ',
    '؟ ',
    '! ',
    ' - ',
  ];

  chunkText(fullText: string, options?: ChunkerOptions): TextChunk[] {
    const maxChunk = options?.maxChunkSize || 650;
    const overlap = options?.overlapSize || 100;

    if (!fullText || typeof fullText !== 'string') {
      return [];
    }

    const clean = fullText.trim().replace(/\r\n/g, '\n');
    if (clean.length <= maxChunk) {
      return [
        {
          index: 0,
          text: clean,
          tokenCount: Math.ceil(clean.length / 4),
          metadata: { startChar: 0, endChar: clean.length },
        },
      ];
    }

    const chunks: TextChunk[] = [];
    let startIdx = 0;
    let chunkIndex = 0;

    while (startIdx < clean.length) {
      let endIdx = Math.min(startIdx + maxChunk, clean.length);

      // If we're not at the very end of text, find the nearest clean sentence/paragraph break
      if (endIdx < clean.length) {
        let bestBreak = -1;
        for (const delim of this.sentenceDelimiters) {
          const lastDelim = clean.lastIndexOf(delim, endIdx);
          if (lastDelim > startIdx + (maxChunk * 0.5)) {
            bestBreak = lastDelim + delim.length;
            break;
          }
        }
        if (bestBreak !== -1) {
          endIdx = bestBreak;
        }
      }

      const chunkStr = clean.slice(startIdx, endIdx).trim();

      if (chunkStr.length > 30) {
        // Try to identify an active heading in the chunk
        const headingMatch = chunkStr.match(/^([#*-]+|\bماده|\bبند|\bفصل|\bدستورالعمل|\bبخش)\s+([^\n]+)/);
        const heading = headingMatch ? headingMatch[0].trim() : undefined;

        chunks.push({
          index: chunkIndex++,
          text: chunkStr,
          tokenCount: Math.ceil(chunkStr.length / 4),
          metadata: {
            heading,
            startChar: startIdx,
            endChar: endIdx,
          },
        });
      }

      if (endIdx >= clean.length) {
        break;
      }

      // Step forward with overlap
      startIdx = Math.max(startIdx + 1, endIdx - overlap);
    }

    return chunks;
  }
}

export const textChunker = new TextChunker();
