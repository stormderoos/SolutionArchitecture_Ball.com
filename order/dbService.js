const db = require("./dbRepository");

// Canonical order lifecycle. The index is the progression rank of a status.
// The order aggregate may only move its status FORWARD along this flow, never back.
// This keeps the final status deterministic even though independent services
// (payment -> "Paid", warehouse -> "Picking products"/"Products picked",
//  shipping -> "Shipment pending"/"Shipped") report back concurrently.
const ORDER_STATUS_FLOW = [
    "Order created",
    "Paid",
    "Picking products",
    "Products picked",
    "Shipment pending",
    "Shipped",
    "Delivered"
];

// Return the progression rank of a status (-1 for unknown statuses).
function statusRank(status) {
    return ORDER_STATUS_FLOW.indexOf(status);
}

module.exports = {
    // Create an order
    async createOrder(order, orderProducts) {
        try {
            // Create an order
            const createdOrder = await db.createOrder(order);

            // Create the order product connections
            for (const op of orderProducts) {
                await db.createOrderProduct(createdOrder.orderId, op.productId, op.amount);
            }

            return createdOrder;
        } catch (error) {
            console.error("Error creating order:", error);
            throw error;
        }
    },

    // Update an order
    async updateOrder(order, orderProducts) {
        try {
            // Update order products and the order
            const updatedOrderProducts = await this.updateOrderProducts(order.orderId, orderProducts);
            const updatedOrder = await db.updateOrder(order);

            // The data to return
            dataToReturn = {
                order: updatedOrder,
                orderProducts: updatedOrderProducts
            }

            return dataToReturn;
        } catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    },

    //Update an order status
    async updateOrderStatus(orderId, orderStatus) {
        try {
            // Read the current status so we can enforce the forward-only invariant
            const current = await db.getOrder(orderId);
            const currentStatus = current ? current.orderStatus : null;

            // Never move the status backwards: only apply the update if the new
            // status is further along the lifecycle than the current one.
            if (currentStatus !== null && statusRank(orderStatus) <= statusRank(currentStatus)) {
                console.log(
                    `[OrderService] Ignoring status '${orderStatus}' for order ${orderId}: not ahead of current '${currentStatus}'`
                );
                return { orderId, orderStatus: currentStatus };
            }

            // Update the order status
            const order = await db.updateOrderStatus(orderId, orderStatus);

            return order;
        } catch (error) {
            console.error("Error updating order status:", error);
            throw error;
        }
    },

    // Delete an order
    async deleteOrder(orderId) {
        try {
            // Get the product order connections
            const orderProducts = await db.getOrderProductsByOrderId(orderId);

            // Delete order products
            for (const op of orderProducts) {
                db.deleteOrderProduct(op.orderId, op.productId);
            }

            // Delete an order
            return await db.deleteOrder(orderId);
        } catch (error) {
            console.error("Error deleting order:", error);
            throw error;
        }
    },

    // Create a customer
    async createCustomer(customer) {
        try {
            return await db.createCustomer(customer);
        } catch (error) {
            console.error("Error creating customer:", error);
            throw error;
        }
    },

    // Update a customer
    async updateCustomer(customer) {
        try {
            return await db.updateCustomer(customer);
        } catch (error) {
            console.error("Error updating customer:", error);
            throw error;
        }
    },

    // Delete a customer
    async deleteCustomer(customerId) {
        try {
            // Get orders by the customer id
            const orders = db.getOrdersByCustomerId(customerId);

            // Delete orders
            for (const o of orders) {
                db.deleteOrder(o.orderId);
            }

            // Delete a customer
            return await db.deleteCustomer(customerId);
        } catch (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    },

    // Create a product
    async createProduct(product) {
        try {
            return await db.createProduct(product);
        } catch (error) {
            console.error("Error creating product:", error);
            throw error;
        }
    },

    // Update a product
    async updateProduct(product) {
        try {
            return await db.updateProduct(product);
        } catch (error) {
            console.error("Error updating product:", error);
            throw error;
        }
    },

    // Insert or update a product replica from the Catalog (upstream). Idempotent.
    async upsertProduct(product) {
        try {
            return await db.upsertProduct(product);
        } catch (error) {
            console.error("Error upserting product:", error);
            throw error;
        }
    },

    // Delete a product
    async deleteProduct(productId) {
        try {
            // Get the product order connections
            const oredrProducts = db.getOrderProductsByOrderId(productId);

            // Delete order products
            for (const op of orderProducts) {
                db.deleteOrderProduct(op.orderId, op.productId);
            }

            // Delete a product
            return await db.deleteProduct(productId);
        } catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    },

    // Update a order product
    async updateOrderProducts(orderId, orderProducts) {
        try {
            // Update order products
            for (const op of orderProducts) {
                // Get the product order connection
                const orderProduct = db.getOrderProduct(orderId, op.productId);

                // Update or create the order product
                if (orderProduct === null) {
                    db.createOrderProduct(orderId, op.productId, op.amount);
                } else {
                    db.updateOrderProduct(orderId, op.productId, op.amount);
                }
            }

            return orderProducts;
        } catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    },

    // Create an event log
    async createEventLog(eventLog) {
        try {
            return await db.createEventLog(eventLog);
        } catch (error) {
            console.error("Error creating event log:", error);
            throw error;
        }
    }
};
