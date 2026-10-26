/**
 * Web Worker Message & Response Protocol for HSECORE
 */

export type WorkerTaskType =
  | 'EXCEL_PARSE_PERSONNEL'
  | 'EXCEL_PARSE_MEDICAL_EXAMS'
  | 'CALCULATE_SAFETY_PYRAMID'
  | 'CALCULATE_HEALTH_ENV_KPIS'
  | 'CALCULATE_FIRE_DEPT_STATS'
  | 'FILTER_AND_SORT_DATASET'
  | 'CALCULATE_MULTI_YEAR_TRENDS';

export interface WorkerTaskRequest<T = any> {
  taskId: string;
  type: WorkerTaskType;
  payload: T;
  timestamp: number;
}

export interface WorkerTaskProgress {
  taskId: string;
  type: 'PROGRESS';
  progress: number; // 0 - 100
  statusMessage?: string;
}

export interface WorkerTaskSuccess<R = any> {
  taskId: string;
  type: 'SUCCESS';
  result: R;
  executionTimeMs: number;
}

export interface WorkerTaskError {
  taskId: string;
  type: 'ERROR';
  error: string;
  stack?: string;
}

export type WorkerTaskResponse<R = any> =
  | WorkerTaskProgress
  | WorkerTaskSuccess<R>
  | WorkerTaskError;

export interface WorkerPoolOptions {
  maxWorkers?: number;
  idleTimeoutMs?: number;
}
