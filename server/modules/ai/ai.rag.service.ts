/**
 * HSECORE RAG & Semantic Vector Search Service
 * Connects PostgreSQL knowledge base with BGE-M3 local embedding model.
 */

import { db, schema } from '../../core/db.ts';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { textChunker } from './ai.chunker.ts';
import { localAIProvider } from './ai.local-provider.ts';
import { logger } from '../../core/logger.ts';
import { isGlobalAdminUser, type UserContext } from '../../core/middleware/auth.ts';
import { canAccessKnowledgeDocument, type KnowledgeDocumentAccessControl } from './ai.acl.ts';

export interface RelevantChunkResult {
  docId: number;
  docTitle: string;
  category: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
  metadata?: any;
}

export class AIRagService {
  /**
   * Compute Cosine Similarity between two dense float vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Fast Persian/English Keyword Overlap Score (Fallback when embedding model is offline)
   */
  private calculateKeywordScore(query: string, text: string): number {
    const qTokens = query
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2);

    if (qTokens.length === 0) return 0;

    const lowerText = text.toLowerCase();
    let matches = 0;

    for (const token of qTokens) {
      if (lowerText.includes(token)) {
        matches++;
      }
    }

    return matches / qTokens.length;
  }

  /**
   * Index a new technical document or regulation into the Knowledge Base
   */
  async indexDocument(params: {
    title: string;
    content: string;
    docType?: string;
    category?: string;
    uploadedBy?: string;
    summary?: string;
    accessControl?: KnowledgeDocumentAccessControl;
  }): Promise<{ docId: number; id: number; chunkCount: number }> {
    const { title, content, docType = 'REGULATION', category = 'GENERAL', uploadedBy, summary, accessControl } = params;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
      throw new Error('عنوان سند باید بین ۱ تا ۲۰۰ نویسه باشد.');
    }
    if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content, 'utf8') > 256 * 1024) {
      throw new Error('متن سند خالی یا بزرگ‌تر از سقف مجاز ۲۵۶ کیلوبایت است.');
    }
    if (summary !== undefined && (typeof summary !== 'string' || summary.length > 2000)) {
      throw new Error('خلاصه سند نباید بیش از ۲۰۰۰ نویسه باشد.');
    }

    // Validate and chunk before inserting the header so rejected documents leave no PENDING row.
    const chunks = textChunker.chunkText(content, { maxChunkSize: 650, overlapSize: 100 });
    if (chunks.length > 500) {
      throw new Error('تعداد بخش‌های سند از سقف مجاز ۵۰۰ بیشتر است.');
    }

    // 1. Create Document Header in DB
    const [doc] = await db
      .insert(schema.aiKnowledgeDocs)
      .values({
        title,
        docType,
        category,
        content,
        summary,
        metadata: accessControl ? { accessControl } : {},
        fileSize: Buffer.byteLength(content, 'utf8'),
        chunkCount: 0,
        status: 'PENDING',
        uploadedBy: uploadedBy || 'system',
      })
      .returning();

    const docId = doc.id;

    // 2. Persist prevalidated chunks.
    if (chunks.length === 0) {
      await db.update(schema.aiKnowledgeDocs).set({ status: 'INDEXED', chunkCount: 0 }).where(eq(schema.aiKnowledgeDocs.id, docId));
      return { docId, id: docId, chunkCount: 0 };
    }

    // 3. Generate embeddings & save chunks
    for (const ch of chunks) {
      let embeddingVector: number[] | null = null;

      try {
        const embRes = await localAIProvider.generateEmbedding(ch.text);
        if (embRes && embRes.embedding && embRes.embedding.length > 0) {
          embeddingVector = embRes.embedding;
        }
      } catch {
        // Fallback: embedding deferred
      }

      await db.insert(schema.aiKnowledgeChunks).values({
        docId,
        chunkIndex: ch.index,
        chunkText: ch.text,
        tokenCount: ch.tokenCount,
        embedding: embeddingVector,
        metadata: ch.metadata || {},
      });
    }

    // 4. Update Document Status
    await db
      .update(schema.aiKnowledgeDocs)
      .set({
        chunkCount: chunks.length,
        status: 'INDEXED',
        updatedAt: new Date(),
      })
      .where(eq(schema.aiKnowledgeDocs.id, docId));

    logger.info(`[AIRagService] Indexed document "${title}" (ID: ${docId}) into ${chunks.length} chunks`);

    return { docId, id: docId, chunkCount: chunks.length };
  }

  /**
   * Query Relevant Knowledge Chunks using Vector Cosine Similarity or Keyword Matching
   */
  async queryRelevantChunks(
    query: string,
    options?: { topK?: number; minScore?: number; category?: string; allowedCategories?: string[]; userContext?: UserContext }
  ): Promise<RelevantChunkResult[]> {
    const topK = options?.topK || 4;
    const minScore = options?.minScore ?? 0.45;
    const allowedCategories = options?.allowedCategories || [];
    if (allowedCategories.length === 0) return [];
    if (options?.category && options.category !== 'ALL' && !allowedCategories.includes(options.category)) return [];

    const user = options?.userContext;
    if (!user) return [];

    // Resolve authorized document IDs before fetching chunks. Applying the 200-row
    // chunk limit before ACL filtering can let inaccessible documents crowd out
    // authorized results (false negatives) and makes the retrieval boundary unclear.
    const scope = await this.resolveUserOrgScope(user);
    const documentConditions = [
      eq(schema.aiKnowledgeDocs.status, 'INDEXED'),
      inArray(schema.aiKnowledgeDocs.category, allowedCategories),
    ];
    if (options?.category && options.category !== 'ALL') {
      documentConditions.push(eq(schema.aiKnowledgeDocs.category, options.category));
    }

    const candidateDocs = await db
      .select({
        id: schema.aiKnowledgeDocs.id,
        metadata: schema.aiKnowledgeDocs.metadata,
      })
      .from(schema.aiKnowledgeDocs)
      .where(and(...documentConditions));

    const authorizedDocIds = candidateDocs
      .filter(doc => canAccessKnowledgeDocument(doc.metadata, user, scope))
      .map(doc => doc.id);

    if (authorizedDocIds.length === 0) return [];

    // The retrieval limit now applies only to chunks belonging to authorized docs.
    const chunkRows = await db
      .select({
        chunkId: schema.aiKnowledgeChunks.id,
        docId: schema.aiKnowledgeChunks.docId,
        chunkIndex: schema.aiKnowledgeChunks.chunkIndex,
        chunkText: schema.aiKnowledgeChunks.chunkText,
        embedding: schema.aiKnowledgeChunks.embedding,
        metadata: schema.aiKnowledgeChunks.metadata,
        docTitle: schema.aiKnowledgeDocs.title,
        category: schema.aiKnowledgeDocs.category,
      })
      .from(schema.aiKnowledgeChunks)
      .innerJoin(schema.aiKnowledgeDocs, eq(schema.aiKnowledgeChunks.docId, schema.aiKnowledgeDocs.id))
      .where(and(
        eq(schema.aiKnowledgeDocs.status, 'INDEXED'),
        inArray(schema.aiKnowledgeDocs.category, allowedCategories),
        inArray(schema.aiKnowledgeChunks.docId, authorizedDocIds),
      ))
      .limit(200);

    // 2. Try generating query embedding vector
    let queryEmbedding: number[] | null = null;
    try {
      const qRes = await localAIProvider.generateEmbedding(query);
      if (qRes && qRes.embedding && qRes.embedding.length > 0) {
        queryEmbedding = qRes.embedding;
      }
    } catch {}

    // 3. Score chunks
    const scoredChunks: RelevantChunkResult[] = [];

    for (const row of chunkRows) {
      let score = 0;

      if (queryEmbedding && Array.isArray(row.embedding) && row.embedding.length > 0) {
        // Vector cosine similarity
        score = this.cosineSimilarity(queryEmbedding, row.embedding as number[]);
      } else {
        // Fallback keyword score
        score = this.calculateKeywordScore(query, row.chunkText);
      }

      if (score >= minScore) {
        scoredChunks.push({
          docId: row.docId,
          docTitle: row.docTitle,
          category: row.category,
          chunkIndex: row.chunkIndex,
          chunkText: row.chunkText,
          score: Math.round(score * 100) / 100,
          metadata: row.metadata,
        });
      }
    }

    // 4. Sort descending by score and pick top-K
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
  }

  /**
   * List all documents in the Knowledge Base
   */
  private async resolveUserOrgScope(user: UserContext): Promise<{ departmentIds: number[]; unitIds: number[]; assignments: Array<{ departmentId: number | null; unitId: number | null }> }> {
    if (isGlobalAdminUser(user)) return { departmentIds: [], unitIds: [], assignments: [] };

    const byPersonnelCode = user.personnelCode
      ? await db.select({
          id: schema.personnel.id,
          departmentId: schema.personnel.departmentId,
          unitId: schema.personnel.unitId,
        }).from(schema.personnel).where(eq(schema.personnel.personnelCode, user.personnelCode))
      : [];
    const byAssignment = user.uid
      ? await db.select({
          id: schema.personnel.id,
          departmentId: schema.personnel.departmentId,
          unitId: schema.personnel.unitId,
        }).from(schema.personnel)
        .innerJoin(schema.userPersonnelAssignments, eq(schema.userPersonnelAssignments.personnelId, schema.personnel.id))
        .where(eq(schema.userPersonnelAssignments.userUid, user.uid))
      : [];
    const resolvedRows = [...new Map([...byPersonnelCode, ...byAssignment].map(row => [row.id, row])).values()];

    return {
      departmentIds: [...new Set(resolvedRows.map(row => row.departmentId).filter((id): id is number => id !== null))],
      unitIds: [...new Set(resolvedRows.map(row => row.unitId).filter((id): id is number => id !== null))],
      assignments: resolvedRows.map(row => ({ departmentId: row.departmentId, unitId: row.unitId })),
    };
  }
  async canAccessDocument(docId: number, allowedCategories: string[] = [], userContext?: UserContext): Promise<boolean> {
    if (!userContext || allowedCategories.length === 0) return false;

    const [doc] = await db
      .select({
        id: schema.aiKnowledgeDocs.id,
        metadata: schema.aiKnowledgeDocs.metadata,
      })
      .from(schema.aiKnowledgeDocs)
      .where(and(
        eq(schema.aiKnowledgeDocs.id, docId),
        inArray(schema.aiKnowledgeDocs.category, allowedCategories),
      ))
      .limit(1);

    if (!doc) return false;

    const scope = await this.resolveUserOrgScope(userContext);
    return canAccessKnowledgeDocument(doc.metadata, userContext, scope);
  }

  async listDocuments(allowedCategories: string[] = [], userContext?: UserContext) {
    if (allowedCategories.length === 0 || !userContext) return [];
    const docs = await db
      .select({
        id: schema.aiKnowledgeDocs.id,
        title: schema.aiKnowledgeDocs.title,
        docType: schema.aiKnowledgeDocs.docType,
        category: schema.aiKnowledgeDocs.category,
        fileSize: schema.aiKnowledgeDocs.fileSize,
        chunkCount: schema.aiKnowledgeDocs.chunkCount,
        status: schema.aiKnowledgeDocs.status,
        metadata: schema.aiKnowledgeDocs.metadata,
        createdAt: schema.aiKnowledgeDocs.createdAt,
      })
      .from(schema.aiKnowledgeDocs)
      .where(inArray(schema.aiKnowledgeDocs.category, allowedCategories))
      .orderBy(desc(schema.aiKnowledgeDocs.createdAt));

    const scope = await this.resolveUserOrgScope(userContext);
    return docs
      .filter(doc => canAccessKnowledgeDocument(doc.metadata, userContext, scope))
      .map(({ metadata, ...doc }) => doc);
  }

  /**
   * Delete a document and its cascading chunks
   */
  async deleteDocument(docId: number): Promise<boolean> {
    await db.delete(schema.aiKnowledgeDocs).where(eq(schema.aiKnowledgeDocs.id, docId));
    return true;
  }
}

export const aiRagService = new AIRagService();
