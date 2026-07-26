import { performance } from "perf_hooks";
import { AsyncLocalStorage } from "async_hooks";

export interface StepProfileRecord {
  runId: number;
  traceId: string;
  stepName: string;
  fileLine: string;
  category: "DB query" | "Lock" | "External call" | "In-process compute";
  queryOrDetails: string;
  durationMs: number;
  isSequential: boolean;
  notes?: string;
}

interface ProfilerContext {
  traceId: string;
  runId: number;
}

const asyncLocalStorage = new AsyncLocalStorage<ProfilerContext>();

class StepProfiler {
  private runs: Map<number, StepProfileRecord[]> = new Map();
  private traces: Map<string, StepProfileRecord[]> = new Map();
  private fallbackRunId: number = 1;
  private fallbackTraceId: string = "";

  public runWithContext<T>(context: Partial<ProfilerContext>, fn: () => T): T {
    const parentStore = asyncLocalStorage.getStore();
    const merged: ProfilerContext = {
      traceId: context.traceId || parentStore?.traceId || this.fallbackTraceId,
      runId: context.runId !== undefined ? context.runId : (parentStore?.runId ?? this.fallbackRunId),
    };

    if (merged.traceId && !this.traces.has(merged.traceId)) {
      this.traces.set(merged.traceId, []);
    }
    if (merged.runId !== undefined && !this.runs.has(merged.runId)) {
      this.runs.set(merged.runId, []);
    }

    return asyncLocalStorage.run(merged, fn);
  }

  public setRunId(id: number) {
    this.fallbackRunId = id;
    const store = asyncLocalStorage.getStore();
    if (store) {
      store.runId = id;
    }
    if (!this.runs.has(id)) {
      this.runs.set(id, []);
    }
  }

  public getRunId(): number {
    const store = asyncLocalStorage.getStore();
    return store?.runId ?? this.fallbackRunId;
  }

  public setTraceId(traceId: string) {
    this.fallbackTraceId = traceId;
    const store = asyncLocalStorage.getStore();
    if (store) {
      store.traceId = traceId;
    }
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
  }

  public getTraceId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.traceId ?? this.fallbackTraceId;
  }

  public async time<T>(
    stepName: string,
    fileLine: string,
    category: "DB query" | "Lock" | "External call" | "In-process compute",
    queryOrDetails: string,
    isSequential: boolean,
    fn: () => Promise<T>,
    notes?: string,
    traceId?: string
  ): Promise<T> {
    const store = asyncLocalStorage.getStore();
    const effectiveTraceId = traceId || store?.traceId || this.fallbackTraceId;
    const effectiveRunId = store?.runId ?? this.fallbackRunId;
    const startTimeMs = Date.now();
    const startIso = new Date(startTimeMs).toISOString();
    const startPerf = performance.now();

    console.log(`⏱️ [PIPELINE_TIMING] [START] [${effectiveTraceId || "no-trace"}] ${stepName} at ${startIso} (${startTimeMs} ms)`);
    try {
      return await fn();
    } finally {
      const endPerf = performance.now();
      const endTimeMs = Date.now();
      const endIso = new Date(endTimeMs).toISOString();
      const durationMs = Math.round((endPerf - startPerf) * 100) / 100;
      const record: StepProfileRecord = {
        runId: effectiveRunId,
        traceId: effectiveTraceId,
        stepName,
        fileLine,
        category,
        queryOrDetails,
        durationMs,
        isSequential,
        notes
      };
      if (!this.runs.has(effectiveRunId)) {
        this.runs.set(effectiveRunId, []);
      }
      this.runs.get(effectiveRunId)!.push(record);
      if (effectiveTraceId) {
        if (!this.traces.has(effectiveTraceId)) {
          this.traces.set(effectiveTraceId, []);
        }
        this.traces.get(effectiveTraceId)!.push(record);
      }
      console.log(`⏱️ [PIPELINE_TIMING] [END]   [${effectiveTraceId || "no-trace"}] ${stepName} at ${endIso} (${endTimeMs} ms) | Duration: ${durationMs} ms`);
    }
  }

  public recordSync(
    stepName: string,
    fileLine: string,
    category: "DB query" | "Lock" | "External call" | "In-process compute",
    queryOrDetails: string,
    durationMs: number,
    isSequential: boolean,
    notes?: string,
    traceId?: string
  ) {
    const store = asyncLocalStorage.getStore();
    const effectiveTraceId = traceId || store?.traceId || this.fallbackTraceId;
    const effectiveRunId = store?.runId ?? this.fallbackRunId;
    const record: StepProfileRecord = {
      runId: effectiveRunId,
      traceId: effectiveTraceId,
      stepName,
      fileLine,
      category,
      queryOrDetails,
      durationMs: Math.round(durationMs * 100) / 100,
      isSequential,
      notes
    };
    if (!this.runs.has(effectiveRunId)) {
      this.runs.set(effectiveRunId, []);
    }
    this.runs.get(effectiveRunId)!.push(record);
    if (effectiveTraceId) {
      if (!this.traces.has(effectiveTraceId)) {
        this.traces.set(effectiveTraceId, []);
      }
      this.traces.get(effectiveTraceId)!.push(record);
    }
    console.log(`⏱️ [TRACE ${effectiveTraceId}] [RUN ${effectiveRunId}] [${category}] ${stepName} (${fileLine}): ${record.durationMs} ms`);
  }

  public getRecords(runId?: number): StepProfileRecord[] {
    if (runId !== undefined) {
      return this.runs.get(runId) || [];
    }
    const all: StepProfileRecord[] = [];
    for (const records of this.runs.values()) {
      all.push(...records);
    }
    return all;
  }

  public getRecordsByTrace(traceId: string): StepProfileRecord[] {
    return this.traces.get(traceId) || [];
  }

  public getAllTraces(): Map<string, StepProfileRecord[]> {
    return this.traces;
  }

  public getAllRuns(): Map<number, StepProfileRecord[]> {
    return this.runs;
  }

  public clear() {
    this.runs.clear();
    this.traces.clear();
    this.fallbackRunId = 1;
    this.fallbackTraceId = "";
  }
}

export const stepProfiler = new StepProfiler();

