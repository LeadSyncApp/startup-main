import { Worker } from "node:worker_threads";
import path from "node:path";
import crypto from "node:crypto";

export interface TaskMetric {
  id: string;
  type: "WARMUP" | "EMBED" | "RERANK";
  workerId: number;
  queueWaitMs: number;
  execMs: number;
  totalMs: number;
  enqueuedAt: number;
  completedAt: number;
}

export interface OnnxWorkerTask {
  id: string;
  type: "WARMUP" | "EMBED" | "RERANK";
  text?: string;
  query?: string;
  documents?: string[];
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutTimer?: NodeJS.Timeout;
  enqueuedAt?: number;
  startedAt?: number;
  completedAt?: number;
}

interface WorkerInstance {
  id: number;
  worker: Worker;
  isBusy: boolean;
  activeTaskId: string | null;
}

export class OnnxWorkerPool {
  private poolSize: number;
  private timeoutMs: number;
  private workers: WorkerInstance[] = [];
  private taskQueue: OnnxWorkerTask[] = [];
  private pendingTasks: Map<string, OnnxWorkerTask> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private nextWorkerId = 1;
  private taskMetrics: TaskMetric[] = [];
  private maxQueueDepthSeen = 0;

  constructor(poolSize: number = 1, timeoutMs: number = 10000) {
    const envSize = parseInt(process.env.ONNX_WORKER_POOL_SIZE || "", 10);
    this.poolSize = !isNaN(envSize) && envSize > 0 ? envSize : poolSize;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Initialize the pool and warm up models across worker threads
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      console.log(`[OnnxWorkerPool] Initializing ONNX worker pool (poolSize=${this.poolSize})...`);
      const warmupPromises: Promise<void>[] = [];

      for (let i = 0; i < this.poolSize; i++) {
        const instance = this.createWorker();
        warmupPromises.push(
          this.enqueueTaskOnWorker(instance, {
            id: crypto.randomUUID(),
            type: "WARMUP",
          })
        );
      }

      await Promise.all(warmupPromises);
      this.isInitialized = true;
      console.log(`[OnnxWorkerPool] ONNX worker pool initialized and pre-warmed OK.`);
    })();

    return this.initPromise;
  }

  private createWorker(): WorkerInstance {
    const workerId = this.nextWorkerId++;
    const isTs = __filename.endsWith(".ts");
    const workerPath = isTs
      ? path.resolve(__dirname, "../workers/onnxInference.worker.ts")
      : path.resolve(__dirname, "../workers/onnxInference.worker.js");

    const workerOptions = isTs
      ? { execArgv: ["-r", "ts-node/register"] }
      : {};

    const worker = new Worker(workerPath, workerOptions);
    const instance: WorkerInstance = {
      id: workerId,
      worker,
      isBusy: false,
      activeTaskId: null,
    };

    worker.on("message", (msg: any) => {
      this.handleWorkerMessage(instance, msg);
    });

    worker.on("error", (err: Error) => {
      console.error(`[OnnxWorkerPool] Worker #${workerId} error:`, err.message);
      this.handleWorkerCrash(instance, err);
    });

    worker.on("exit", (code: number) => {
      if (code !== 0 && this.isInitialized) {
        console.warn(`[OnnxWorkerPool] Worker #${workerId} exited with code ${code}`);
        this.handleWorkerCrash(instance, new Error(`Worker exited with code ${code}`));
      }
    });

    this.workers.push(instance);
    return instance;
  }

  private handleWorkerMessage(instance: WorkerInstance, msg: any) {
    const taskId = msg.id;
    const task = this.pendingTasks.get(taskId);

    if (task) {
      if (task.timeoutTimer) {
        clearTimeout(task.timeoutTimer);
      }
      this.pendingTasks.delete(taskId);

      task.completedAt = Date.now();
      const enqueuedAt = task.enqueuedAt || task.startedAt || task.completedAt;
      const startedAt = task.startedAt || enqueuedAt;

      const queueWaitMs = Math.max(0, startedAt - enqueuedAt);
      const execMs = Math.max(0, task.completedAt - startedAt);
      const totalMs = Math.max(0, task.completedAt - enqueuedAt);

      if (task.type !== "WARMUP") {
        this.taskMetrics.push({
          id: task.id,
          type: task.type,
          workerId: instance.id,
          queueWaitMs,
          execMs,
          totalMs,
          enqueuedAt,
          completedAt: task.completedAt,
        });
      }

      if (msg.error) {
        task.reject(new Error(`ONNX Worker Error: ${msg.error}`));
      } else {
        task.resolve(msg.result !== undefined ? msg.result : msg.status);
      }
    }

    instance.isBusy = false;
    instance.activeTaskId = null;
    this.processQueue();
  }

  private handleWorkerCrash(instance: WorkerInstance, error: Error) {
    // Remove crashed worker instance
    this.workers = this.workers.filter((w) => w.id !== instance.id);

    // Reject active task if one was executing on this worker
    if (instance.activeTaskId) {
      const task = this.pendingTasks.get(instance.activeTaskId);
      if (task) {
        if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
        this.pendingTasks.delete(instance.activeTaskId);
        task.reject(new Error(`ONNX Worker crashed mid-execution: ${error.message}`));
      }
    }

    // Auto-spawn replacement worker if initialized
    if (this.isInitialized) {
      console.warn(`[OnnxWorkerPool] Auto-spawning replacement worker after crash...`);
      const replacement = this.createWorker();
      this.enqueueTaskOnWorker(replacement, {
        id: crypto.randomUUID(),
        type: "WARMUP",
      }).catch((e) =>
        console.error("[OnnxWorkerPool] Replacement worker warmup failed:", e.message)
      );
    }

    this.processQueue();
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return;

    const idleWorker = this.workers.find((w) => !w.isBusy);
    if (!idleWorker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    this.dispatchTaskToWorker(idleWorker, task);
  }

  private dispatchTaskToWorker(instance: WorkerInstance, task: OnnxWorkerTask) {
    instance.isBusy = true;
    instance.activeTaskId = task.id;
    task.startedAt = Date.now();
    this.pendingTasks.set(task.id, task);

    // Set per-request timeout (WARMUP tasks allowed up to 120s for model loading/downloading)
    const timeout = task.type === "WARMUP" ? 120000 : this.timeoutMs;
    task.timeoutTimer = setTimeout(() => {
      this.pendingTasks.delete(task.id);
      task.reject(new Error(`ONNX Worker request (${task.type}) timed out after ${timeout}ms`));
      instance.isBusy = false;
      instance.activeTaskId = null;
      this.processQueue();
    }, timeout);

    instance.worker.postMessage({
      id: task.id,
      type: task.type,
      text: task.text,
      query: task.query,
      documents: task.documents,
    });
  }

  private enqueueTaskOnWorker(
    instance: WorkerInstance,
    partialTask: { id: string; type: "WARMUP" | "EMBED" | "RERANK"; text?: string; query?: string; documents?: string[] }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: OnnxWorkerTask = {
        ...partialTask,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };
      this.dispatchTaskToWorker(instance, task);
    });
  }

  public executeTask(partialTask: { type: "EMBED" | "RERANK"; text?: string; query?: string; documents?: string[] }): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: OnnxWorkerTask = {
        id: crypto.randomUUID(),
        ...partialTask,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };

      const idleWorker = this.workers.find((w) => !w.isBusy);
      if (idleWorker) {
        this.dispatchTaskToWorker(idleWorker, task);
      } else {
        this.taskQueue.push(task);
        if (this.taskQueue.length > this.maxQueueDepthSeen) {
          this.maxQueueDepthSeen = this.taskQueue.length;
        }
      }
    });
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.isInitialized) await this.init();
    return this.executeTask({ type: "EMBED", text });
  }

  public async rerank(query: string, documents: string[]): Promise<number[]> {
    if (!this.isInitialized) await this.init();
    return this.executeTask({ type: "RERANK", query, documents });
  }

  public getMetrics(): TaskMetric[] {
    return [...this.taskMetrics];
  }

  public clearMetrics(): void {
    this.taskMetrics = [];
    this.maxQueueDepthSeen = 0;
  }

  public getMaxQueueDepth(): number {
    return this.maxQueueDepthSeen;
  }

  public getPoolSize(): number {
    return this.poolSize;
  }

  public async shutdown(): Promise<void> {
    console.log("[OnnxWorkerPool] Shutting down worker pool...");
    this.isInitialized = false;
    this.initPromise = null;

    for (const task of this.pendingTasks.values()) {
      if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
      task.reject(new Error("OnnxWorkerPool shutting down"));
    }
    this.pendingTasks.clear();
    this.taskQueue = [];

    const terminatePromises = this.workers.map((w) => w.worker.terminate());
    await Promise.all(terminatePromises);
    this.workers = [];
  }
}

// Export default singleton instance
export const onnxWorkerPool = new OnnxWorkerPool();

