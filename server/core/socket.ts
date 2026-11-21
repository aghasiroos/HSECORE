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
]);

// Bounded event history ring buffer for client catch-up after temporary disconnects
const EVENT_HISTORY_LIMIT = 1500;
let monotonicSeq = 0;
const eventHistory: MutationEventEnvelope[] = [];

// Short-lived per-user PersonnelAccessContext cache for high-frequency socket filtering
const socketAccessCtxCache = new Map<string, { ctx: PersonnelAccessContext; expiresAt: number }>();

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

  // 2. Sensitive admin-only settings, audit logs, users list
  if (ADMIN_SOCKET_KEYS.has(settingKey) || rawEntity === 'audit_logs' || rawEntity === 'audit') {
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

  // 4. Personnel-scoped operational records
  if (PERSONNEL_SCOPED_ENTITIES.has(rawEntity) || PERSONNEL_SCOPED_ENTITIES.has(settingKey)) {
    const accessCtx = await getCachedAccessContext(user);
    if (accessCtx.canAccessAll) return true;

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
  user: UserContext
): Promise<{ events: MutationEventEnvelope[]; latestSeq: number; resyncRequired: boolean }> {
  const cleanSince = Number.isFinite(sinceSeq) ? Math.max(0, Math.floor(sinceSeq)) : 0;
  const oldestBufferedSeq = eventHistory.length > 0 ? eventHistory[0].seq : monotonicSeq + 1;
  const resyncRequired = cleanSince > 0 && eventHistory.length >= EVENT_HISTORY_LIMIT && cleanSince < oldestBufferedSeq - 1;

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
    resyncRequired,
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
      maxHttpBufferSize: 1e8,
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
          serverTime: new Date().toISOString(),
        });
      } else {
        socket.emit('sync:hello', {
          authenticated: false,
          latestSeq: monotonicSeq,
          serverTime: new Date().toISOString(),
        });
      }

      socket.on('sync:catchup', async (payload: { sinceSeq?: number }, ack?: (res: any) => void) => {
        if (!user || !user.uid) {
          ack?.({ success: false, events: [], latestSeq: monotonicSeq, resyncRequired: false });
          return;
        }
        try {
          const result = await getMissedMutationEvents(Number(payload?.sinceSeq || 0), user);
          ack?.({ success: true, ...result });
        } catch (err: any) {
          ack?.({ success: false, error: err?.message || 'Catchup failed', resyncRequired: true });
        }
      });

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
  // 1. Scoped Socket.IO delivery
  try {
    for (const sock of socketService.getSockets()) {
      const user = sock.data?.user as UserContext | undefined;
      if (!user || !user.uid) continue;
      try {
        const allowed = await canDeliverToUser(envelope, user, targetUserUid);
        if (allowed) {
          sock.emit('data_mutated', envelope);
        }
      } catch {
        // Ignore single-socket error
      }
    }
  } catch (err: any) {
    logger.warn('Socket broadcast warning:', { error: err?.message });
  }

  // 2. Scoped SSE delivery
  const deadClients: SseClientEntry[] = [];
  for (const client of sseClients) {
    try {
      const allowed = await canDeliverToUser(envelope, client.user, targetUserUid);
      if (allowed) {
        const message = `event: data_mutated\nid: ${envelope.seq}\ndata: ${JSON.stringify(envelope)}\n\n`;
        client.res.write(message);
      }
    } catch {
      deadClients.push(client);
    }
  }
  for (const dead of deadClients) {
    sseClients.delete(dead);
  }
}
