import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { Response } from 'express';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { isGlobalAdminUser, normalizeRoleToCanonical, UserContext } from './middleware/auth.ts';
import { personnelAccessService, PersonnelAccessContext } from './personnelAccess.service.ts';
import { maskIntegrationConfigForClient, INTEGRATION_CONFIG_KEY } from '../services/webhookDispatcher.ts';

export interface MutationEventEnvelope {
  eventId: string;
  seq: number;
  module: string;
  entity: string;
  entityType: string;
  recordId: string | number | null;
  operation: string;
  action: string;
  actorId: string | null;
  version: number | null;
  timestamp: string;
  data: any;
}

export interface BroadcastMutationMeta {
  module?: string;
  recordId?: string | number | null;
  actorId?: string | null;
  version?: number | null;
  targetUserUid?: string | null;
}

interface SseClientEntry {
  res: Response;
  user: UserContext;
}

const ADMIN_SOCKET_KEYS = new Set([
  'hse_integration_config',
  'hse_webhook_delivery_logs',
  'hse_system_api_tokens',
  'smtp_config',
  'ldap_config',
  'security_policy',
  'hse_backup_schedule_config',
]);

const PERSONNEL_SCOPED_ENTITIES = new Set([
  'personnel',
  'medicalexams',
  'medical_exams',
  'clinicvisits',
  'nutritionrecords',
  'incidents',
  'permits',
  'workpermits',
  'work_permits',
  'warnings',
  'nonconformances',
  'non_conformances',
  'hse_clinic_visits_v1',
  'hse_nutrition_records_v1',
  'hse_ppe_issuances_v1',
  'hse_training_records_v1',
  'occ_health_exams_data_v2',
  'hse_medical_exams_v4',
  'hse_medical_records_v4',
  'hse_periodic_dossier_attachments_v1',
]);

// Unique boot instance ID so reconnecting clients immediately detect server restarts and resync from PostgreSQL
export const SERVER_INSTANCE_ID = crypto.randomUUID();

// Bounded event history ring buffer for client catch-up after temporary disconnects
const EVENT_HISTORY_LIMIT = 1500;
let monotonicSeq = 0;
const eventHistory: MutationEventEnvelope[] = [];

export function getLatestSeq(): number {
  return monotonicSeq;
}

// Short-lived per-user PersonnelAccessContext cache for high-frequency socket filtering (bounded)
const SOCKET_ACCESS_CACHE_MAX = 500;
const socketAccessCtxCache = new Map<string, { ctx: PersonnelAccessContext; expiresAt: number }>();

const accessCacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of socketAccessCtxCache.entries()) {
    if (entry.expiresAt <= now) {
      socketAccessCtxCache.delete(uid);
    }
  }
}, 60_000);
if (accessCacheCleanupTimer.unref) {
  accessCacheCleanupTimer.unref();
}

export function invalidateRealtimeAccessCache(userUid?: string) {
  if (userUid) {
    socketAccessCtxCache.delete(userUid);
  } else {
    socketAccessCtxCache.clear();
  }
}

async function getCachedAccessContext(user: UserContext): Promise<PersonnelAccessContext> {
  const uid = String(user.uid || user.id || user.username || '');
  const now = Date.now();
  const cached = socketAccessCtxCache.get(uid);
  if (cached && cached.expiresAt > now) {
    return cached.ctx;
  }
  const ctx = await personnelAccessService.resolveAccessContext(user);
  if (socketAccessCtxCache.size >= SOCKET_ACCESS_CACHE_MAX && !socketAccessCtxCache.has(uid)) {
    const oldest = socketAccessCtxCache.keys().next().value;
    if (oldest !== undefined) socketAccessCtxCache.delete(oldest);
  }
  socketAccessCtxCache.set(uid, { ctx, expiresAt: now + 15000 });
  return ctx;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

function verifySocketToken(socket: Socket): UserContext | null {
  let token =
    typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token.trim()
      ? socket.handshake.auth.token.trim()
      : '';

  if (!token) {
    const authHeader = socket.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    const cookies = parseCookies(socket.handshake.headers?.cookie);
    if (cookies.hse_auth_token) {
      token = cookies.hse_auth_token;
    }
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as any;
    if (!decoded || !decoded.uid) return null;
    return {
      uid: decoded.uid,
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      name: decoded.name || decoded.fullName || decoded.username || decoded.email,
      role: decoded.role || 'USER',
      personnelCode: decoded.personnelCode || decoded.personnelNumber,
      department: decoded.department,
      permissions: decoded.permissions,
    };
  } catch {
    return null;
  }
}

function sanitizeEventPayload(entityType: string, data: any): any {
  if (!data || typeof data !== 'object') return data;

  const key = String(data.key || entityType || '');
  if (key === INTEGRATION_CONFIG_KEY) {
    if (data.value !== undefined) {
      return { ...data, value: maskIntegrationConfigForClient(data.value) };
    }
    return maskIntegrationConfigForClient(data);
  }

  if (entityType === 'users' || entityType === 'user') {
    const { passwordHash, password_hash, ...safe } = data;
    return safe;
  }

  return data;
}

function isAdminSocketUser(user?: UserContext | null): boolean {
  if (!user) return false;
  if (isGlobalAdminUser(user)) return true;
  const canonical = normalizeRoleToCanonical(user.role);
  return ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'].includes(canonical);
}

async function canDeliverToUser(
  envelope: MutationEventEnvelope,
  user: UserContext | null | undefined,
  targetUserUid?: string | null
): Promise<boolean> {
  // Unauthenticated sockets NEVER receive domain/settings data_mutated payloads
  if (!user || !user.uid) return false;

  const rawEntity = String(envelope.entityType || '').toLowerCase();
  const settingKey = String(envelope.data?.key || envelope.entityType || '').trim();
  const isAdmin = isAdminSocketUser(user);

  // 1. User-private preferences: ONLY deliver to that exact user
  if (rawEntity === 'user_preferences' || rawEntity === 'user_preference') {
    const ownerUid = String(targetUserUid || envelope.data?.userUid || '');
    return Boolean(ownerUid) && ownerUid === String(user.uid);
  }

  // 2. Sensitive admin-only settings, webhooks, backup configs, audit logs, users list
  if (
    ADMIN_SOCKET_KEYS.has(settingKey) ||
    rawEntity === 'audit_logs' ||
    rawEntity === 'audit' ||
    rawEntity === 'webhooks' ||
    rawEntity === 'backup'
  ) {
    return isAdmin;
  }
  if (rawEntity === 'users' || rawEntity === 'user') {
    if (isAdmin) return true;
    const payloadUid = String(envelope.data?.uid || envelope.recordId || '');
    return Boolean(payloadUid) && payloadUid === String(user.uid);
  }

  // 3. User personnel assignments changes
  if (rawEntity === 'user_assignments') {
    if (isAdmin) return true;
    const payloadUid = String(envelope.data?.uid || '');
    const affected: string[] = Array.isArray(envelope.data?.affectedUserUids)
      ? envelope.data.affectedUserUids.map(String)
      : [];
    return payloadUid === String(user.uid) || affected.includes(String(user.uid));
  }

  // 4. Scoped notifications delivery (never leak user-private notifications to other users)
  if (rawEntity === 'notifications' || rawEntity === 'notification') {
    if (isAdmin) return true;
    const payload = envelope.data;
    if (!payload || typeof payload !== 'object') return true;
    if (payload.isPublic || payload.isEmergency || payload.priority === 'EMERGENCY' || payload.priority === 'CRITICAL') {
      return true;
    }
    const explicitUserId = String(
      targetUserUid || payload.targetUserUid || payload.recipientUserId || payload.userId || payload.uid || ''
    ).trim();
    const recipientIds: string[] = Array.isArray(payload.recipientIds)
      ? payload.recipientIds.map(String)
      : Array.isArray(payload.targetUserIds)
      ? payload.targetUserIds.map(String)
      : [];
    const targetRoles: string[] = Array.isArray(payload.targetRoles)
      ? payload.targetRoles.map((r: any) => normalizeRoleToCanonical(String(r)))
      : [];

    if (explicitUserId || recipientIds.length > 0 || targetRoles.length > 0) {
      const userKeys = new Set(
        [user.uid, user.id, user.username].filter(Boolean).map((v) => String(v))
      );
      if (explicitUserId && userKeys.has(explicitUserId)) return true;
      if (recipientIds.some((id) => userKeys.has(id))) return true;
      const userRole = normalizeRoleToCanonical(user.role);
      if (targetRoles.includes(userRole) || targetRoles.includes('ALL')) return true;
      return false;
    }
    return true;
  }

  // 5. Referrals scoping (deliver content only to participants/admins; metadata refresh signals are safe)
  if (
    rawEntity === 'referrals' ||
    rawEntity === 'document_referrals' ||
    settingKey === 'hse_document_referrals'
  ) {
    if (isAdmin) return true;
    const payload = envelope.data;
    if (payload?.scopedRefresh) return true;
    if (payload && typeof payload === 'object') {
      const userKeys = new Set(
        [user.uid, user.id, user.username, user.name].filter(Boolean).map((v) => String(v).toLowerCase())
      );
      const candidateFields = [
        payload.senderId,
        payload.senderUsername,
        payload.fromUserId,
        payload.recipientId,
        payload.recipientUsername,
        payload.toUserId,
        payload.targetUserId,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      if (candidateFields.length > 0) {
        return candidateFields.some((c) => userKeys.has(c));
      }
    }
    return false;
  }

  // 6. Personnel-scoped operational records
  const lowerSettingKey = settingKey.toLowerCase();
  if (PERSONNEL_SCOPED_ENTITIES.has(rawEntity) || PERSONNEL_SCOPED_ENTITIES.has(lowerSettingKey)) {
    const accessCtx = await getCachedAccessContext(user);
    if (accessCtx.canAccessAll) return true;

    // Minimal scopedRefresh invalidation signals contain zero PII/record payload — safe to trigger client re-fetch
    if (envelope.data?.scopedRefresh) {
      return true;
    }

    const op = String(envelope.operation || '').toLowerCase();
    // On deletes / bulk actions without full record payload, allow ID signal so client can drop stale entry if loaded
    if (op === 'delete' || op === 'batch' || op === 'batch_upsert' || op === 'clearall' || op === 'clear_all' || op === 'deduplicate') {
      return true;
    }

    if (envelope.data && typeof envelope.data === 'object') {
      if (rawEntity === 'personnel') {
        return personnelAccessService.canAccessPersonnel(accessCtx, envelope.data);
      }
      return personnelAccessService.doesModuleRecordMatchContext(accessCtx, envelope.data);
    }
    return false;
  }

  return true;
}

// SSE (Server-Sent Events) authenticated clients registry
const sseClients = new Set<SseClientEntry>();

export function registerSSEClient(res: Response, user: UserContext) {
  const entry: SseClientEntry = { res, user };
  sseClients.add(entry);
  const cleanup = () => {
    sseClients.delete(entry);
  };
  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
}

export function getSSEClientCount(): number {
  return sseClients.size;
}

export async function getMissedMutationEvents(
  sinceSeq: number,
  user: UserContext,
  clientServerInstanceId?: string | null
): Promise<{
  events: MutationEventEnvelope[];
  latestSeq: number;
  serverInstanceId: string;
  resyncRequired: boolean;
}> {
  const cleanSince = Number.isFinite(sinceSeq) ? Math.max(0, Math.floor(sinceSeq)) : 0;
  const oldestBufferedSeq = eventHistory.length > 0 ? eventHistory[0].seq : monotonicSeq + 1;
  const instanceChanged =
    Boolean(clientServerInstanceId) && clientServerInstanceId !== SERVER_INSTANCE_ID;
  const seqAheadOfServer = cleanSince > monotonicSeq;
  const bufferEvicted =
    cleanSince > 0 && eventHistory.length >= EVENT_HISTORY_LIMIT && cleanSince < oldestBufferedSeq - 1;
  const resyncRequired = instanceChanged || seqAheadOfServer || bufferEvicted;

  if (resyncRequired) {
    return {
      events: [],
      latestSeq: monotonicSeq,
      serverInstanceId: SERVER_INSTANCE_ID,
      resyncRequired: true,
    };
  }

  const candidates = eventHistory.filter((ev) => ev.seq > cleanSince);
  const filtered: MutationEventEnvelope[] = [];
  for (const ev of candidates) {
    if (await canDeliverToUser(ev, user, ev.data?.userUid)) {
      filtered.push(ev);
    }
  }
  return {
    events: filtered,
    latestSeq: monotonicSeq,
    serverInstanceId: SERVER_INSTANCE_ID,
    resyncRequired: false,
  };
}

class SocketService {
  private io: SocketServer | null = null;
  private connectedUsers: Map<string, string> = new Map();

  initialize(server: HttpServer) {
    this.io = new SocketServer(server, {
      path: '/socket.io',
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      perMessageDeflate: false,
      pingTimeout: 20000,
      pingInterval: 10000,
      maxHttpBufferSize: 5 * 1024 * 1024, // 5MB cap prevents RAM exhaustion under 50+ concurrent connections
    });

    this.io.use((socket, next) => {
      const verifiedUser = verifySocketToken(socket);
      socket.data.user = verifiedUser;
      socket.data.authenticated = Boolean(verifiedUser);
      next();
    });

    this.io.on('connection', (socket: Socket) => {
      const user: UserContext | null = socket.data.user || null;
      logger.debug(`WebSocket connected: ${socket.id} (authenticated=${Boolean(user)}, uid=${user?.uid || 'anon'})`);

      socket.join('public_emergency');

      if (user && user.uid) {
        this.connectedUsers.set(socket.id, user.uid);
        socket.join('authenticated');
        socket.join(`user:${user.uid}`);
        socket.join(`role:${normalizeRoleToCanonical(user.role)}`);
        if (isAdminSocketUser(user)) {
          socket.join('admin_global');
        }
        socket.emit('sync:hello', {
          authenticated: true,
          uid: user.uid,
          latestSeq: monotonicSeq,
          serverInstanceId: SERVER_INSTANCE_ID,
          serverTime: new Date().toISOString(),
        });
      } else {
        socket.emit('sync:hello', {
          authenticated: false,
          latestSeq: monotonicSeq,
          serverInstanceId: SERVER_INSTANCE_ID,
          serverTime: new Date().toISOString(),
        });
      }

      socket.on(
        'sync:catchup',
        async (payload: { sinceSeq?: number; serverInstanceId?: string }, ack?: (res: any) => void) => {
          if (!user || !user.uid) {
            ack?.({
              success: false,
              events: [],
              latestSeq: monotonicSeq,
              serverInstanceId: SERVER_INSTANCE_ID,
              resyncRequired: false,
            });
            return;
          }
          try {
            const result = await getMissedMutationEvents(
              Number(payload?.sinceSeq || 0),
              user,
              payload?.serverInstanceId
            );
            ack?.({ success: true, ...result });
          } catch (err: any) {
            ack?.({
              success: false,
              error: err?.message || 'Catchup failed',
              serverInstanceId: SERVER_INSTANCE_ID,
              resyncRequired: true,
            });
          }
        }
      );

      socket.on('disconnect', () => {
        logger.debug(`WebSocket disconnected: ${socket.id}`);
        this.connectedUsers.delete(socket.id);
      });

      socket.on('subscribe', (room: string) => {
        if (!user || !user.uid) return;
        const safeRoom = String(room || '').trim();
        if (!safeRoom || safeRoom === 'admin_global' || safeRoom.startsWith('user:')) return;
        socket.join(safeRoom);
      });

      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
      });
    });

    logger.info('WebSocket (Socket.IO) initialized with JWT identity & scoped delivery.');
  }

  getIO(): SocketServer {
    if (!this.io) {
      throw new Error('Socket.io has not been initialized. Please call initialize() first.');
    }
    return this.io;
  }

  getSockets(): Iterable<Socket> {
    if (!this.io) return [];
    return this.io.sockets.sockets.values();
  }

  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  broadcastToRoom(room: string, event: string, data: any) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  close() {
    for (const client of sseClients) {
      try {
        client.res.end();
      } catch {
        // Ignore already-closed SSE streams
      }
    }
    sseClients.clear();
    this.connectedUsers.clear();
    if (this.io) {
      try {
        this.io.close();
      } catch {
        // Ignore shutdown errors
      }
      this.io = null;
    }
  }
}

export const socketService = new SocketService();

/**
 * Universal post-commit broadcast across authorized Socket.IO and SSE clients.
 * Emits monotonic event envelopes with idempotent eventId and RBAC / scope filtering.
 */
export function broadcastDataMutation(
  entityType: string,
  action: string,
  data?: any,
  meta?: BroadcastMutationMeta
) {
  if (
    entityType === 'user_assignments' ||
    entityType === 'users' ||
    entityType === 'personnel'
  ) {
    invalidateRealtimeAccessCache(data?.uid || meta?.targetUserUid);
  }

  monotonicSeq += 1;
  const sanitizedData = sanitizeEventPayload(entityType, data);
  const resolvedRecordId =
    meta?.recordId ??
    sanitizedData?.id ??
    sanitizedData?.uid ??
    sanitizedData?.key ??
    sanitizedData?.planCode ??
    sanitizedData?.sdsUid ??
    null;

  const resolvedVersion =
    meta?.version ??
    (typeof sanitizedData?.version === 'number'
      ? sanitizedData.version
      : typeof sanitizedData?._version === 'number'
      ? sanitizedData._version
      : null);

  const envelope: MutationEventEnvelope = {
    eventId: crypto.randomUUID(),
    seq: monotonicSeq,
    module: meta?.module || String(sanitizedData?.key || entityType),
    entity: entityType,
    entityType,
    recordId: resolvedRecordId,
    operation: action,
    action,
    actorId: meta?.actorId ?? null,
    version: resolvedVersion,
    timestamp: new Date().toISOString(),
    data: sanitizedData,
  };

  eventHistory.push(envelope);
  if (eventHistory.length > EVENT_HISTORY_LIMIT) {
    eventHistory.splice(0, eventHistory.length - EVENT_HISTORY_LIMIT);
  }

  void deliverEnvelopeAsync(envelope, meta?.targetUserUid || sanitizedData?.userUid);
}

async function deliverEnvelopeAsync(envelope: MutationEventEnvelope, targetUserUid?: string | null) {
  // Deduplicate RBAC / personnel-scope evaluation per unique user UID across multiple tabs & SSE streams
  const decisionByUid = new Map<string, Promise<boolean>>();
  const checkAllowedForUser = (user: UserContext): Promise<boolean> => {
    const uid = String(user.uid || user.id || user.username || '');
    let pending = decisionByUid.get(uid);
    if (!pending) {
      pending = canDeliverToUser(envelope, user, targetUserUid).catch(() => false);
      decisionByUid.set(uid, pending);
    }
    return pending;
  };

  // 1. Scoped Socket.IO delivery (concurrent fan-out)
  try {
    const sockets = Array.from(socketService.getSockets());
    await Promise.all(
      sockets.map(async (sock) => {
        const user = sock.data?.user as UserContext | undefined;
        if (!user || !user.uid) return;
        try {
          if (await checkAllowedForUser(user)) {
            sock.emit('data_mutated', envelope);
          }
        } catch {
          // Ignore single-socket error
        }
      })
    );
  } catch (err: any) {
    logger.warn('Socket broadcast warning:', { error: err?.message });
  }

  // 2. Scoped SSE delivery (pre-serialized once, concurrent decision check)
  if (sseClients.size > 0) {
    const serializedMessage = `event: data_mutated\nid: ${envelope.seq}\ndata: ${JSON.stringify(envelope)}\n\n`;
    const deadClients: SseClientEntry[] = [];
    await Promise.all(
      Array.from(sseClients).map(async (client) => {
        try {
          if (await checkAllowedForUser(client.user)) {
            client.res.write(serializedMessage);
          }
        } catch {
          deadClients.push(client);
        }
      })
    );
    for (const dead of deadClients) {
      sseClients.delete(dead);
    }
  }
}
