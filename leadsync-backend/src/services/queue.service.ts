import { generateBotReply, generateStructuredMenu } from "./geminiService";

type Task = () => Promise<any>;

class TaskQueue {
    private queue: Task[] = [];
    private processing = false;
    private concurrency = 5; // Limit to 5 concurrent AI calls to be safe
    private activeCount = 0;

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            this.queue.push(wrappedTask);
            this.process();
        });
    }

    private async process() {
        if (this.queue.length === 0) return;
        if (this.activeCount >= this.concurrency) return;

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

export const aiQueue = new TaskQueue();
