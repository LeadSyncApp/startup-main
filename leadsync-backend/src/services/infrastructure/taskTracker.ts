export class TaskTracker {
  private activeTasks = new Set<Promise<any>>();

  track<T>(promise: Promise<T>): Promise<T> {
    this.activeTasks.add(promise);
    promise.finally(() => {
      this.activeTasks.delete(promise);
    }).catch(() => {}); // Silent catch since actual callers handle errors
    return promise;
  }

  async waitForCompletion(timeoutMs: number): Promise<void> {
    if (this.activeTasks.size === 0) {
      console.log("✅ [TaskTracker] No active tasks to wait for.");
      return;
    }

    console.log(`⏳ [TaskTracker] Waiting for ${this.activeTasks.size} active tasks to complete (timeout: ${timeoutMs}ms)...`);

    const allSettledPromise = Promise.allSettled(Array.from(this.activeTasks));
    
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`⚠️ [TaskTracker] Timeout reached before all tasks completed. Remaining tasks: ${this.activeTasks.size}`);
        resolve();
      }, timeoutMs);
    });

    await Promise.race([allSettledPromise, timeoutPromise]);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.log("🏁 [TaskTracker] Finished waiting for active tasks.");
  }
}

export const taskTracker = new TaskTracker();
