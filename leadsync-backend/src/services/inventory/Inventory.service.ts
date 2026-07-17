import { prisma } from "../../lib/prisma";
import { eventBus, Events } from "../infrastructure/eventBus";
import { emitToCompany } from "../../lib/socket";

export class InventoryService {
    constructor() {
        // Subscribe to events
        eventBus.on(Events.ORDER_CREATED, this.handleOrderCreated.bind(this));
        console.log("📦 [InventoryMicroservice] Initialized and listening for events.");
    }

    async handleOrderCreated(orderId: string, companyId: string) {
        console.log(`📦 [InventoryMicroservice] Received ORDER_CREATED event for Order ${orderId}`);
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { orderItems: true }
            });

            if (!order || !order.orderItems) return;

            // Deduct stock for each valid product
            for (const item of order.orderItems) {
                if (item.productId) {
                    const product = await prisma.product.findUnique({
                        where: { id: item.productId },
                        select: { trackInventory: true }
                    });

                    if (product?.trackInventory) {
                        const currentProduct = await prisma.product.findUnique({
                            where: { id: item.productId },
                            select: { stockQuantity: true }
                        });
                        const currentStock = currentProduct?.stockQuantity || 0;
                        const newStock = Math.max(0, currentStock - item.quantity);

                        await prisma.product.update({
                            where: { id: item.productId },
                            data: {
                                stockQuantity: newStock
                            }
                        });
                        console.log(`📦 [InventoryMicroservice] Deducted ${item.quantity} units from ${item.productId}. New Stock: ${newStock}`);

                        // ✅ NEW: Emit real-time inventory update to all clients in the company
                        emitToCompany(companyId, "inventory_updated", {
                            productId: item.productId,
                            newStock: newStock
                        });
                    } else {
                        console.log(`📦 [InventoryMicroservice] Skipping stock deduction for ${item.productId} (trackInventory: false)`);
                    }
                }
            }
        } catch (error) {
            console.error(`📦 [InventoryMicroservice] Error handling ORDER_CREATED:`, error);
        }
    }
}

export const inventoryService = new InventoryService();
