"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiQueue = void 0;
class TaskQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrency = 20; // Increased for Groq speed (was 5)
        this.activeCount = 0;
    }
    async add(task) {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
            };
            this.queue.push(wrappedTask);
            this.process();
        });
    }
    async process() {
        if (this.queue.length === 0)
            return;
        if (this.activeCount >= this.concurrency)
            return;
        this.activeCount++;
        const task = this.queue.shift();
        if (task) {
            task().finally(() => {
                this.activeCount--;
                this.process();
            });
        }
    }
}
exports.aiQueue = new TaskQueue();
