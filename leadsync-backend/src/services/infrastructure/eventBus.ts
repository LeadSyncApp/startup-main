import { EventEmitter } from 'events';

// In a real enterprise system, this would be Kafka, RabbitMQ, or AWS EventBridge.
// For this application, we use Node's native EventEmitter as a lightweight in-memory message broker.

class SystemEventBus extends EventEmitter {}

export const eventBus = new SystemEventBus();

// Strongly typed event names
export const Events = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
};
