const db = require("./dbRepository");

module.exports = {
    // Create an order
    async createOrder(order, orderProducts) {
        try {
            const createdOrder = await db.createOrder(order);

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
            await this.updateOrderProducts(order.orderId, orderProducts);
            return await db.updateOrder(order);
        } catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    },

    // Get an order
    async getOrder(orderId) {
        try {
            return await db.getOrder(orderId);
        } catch (error) {
            console.error("Error getting order:", error);
            throw error;
        }
    },

    //Update an order status
    async updateOrderStatus(orderId, orderStatus) {
        try {
            // Get the order
            let order = await dbService.getOrder(orderId);

            // Set the order status to the new status
            order.orderStatus = orderStatus;

            order = updateOrder(order);
        } catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    },

    // Delete an order
    async deleteOrder(orderId) {
        try {
            // Get the product order connections
            const oredrProducts = db.getOrderProductByOrderId(orderId);

            // Delete order products
            for (op in orderProducts) {
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
            for (o in orders) {
                db.deleteOrder(o.orderId);
            }

            // Delete a customer
            return await db.deleteCustomer(customerId);
        } catch (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    },

    // Get a customer
    async getCustomer(customerId) {
        try {
            return await db.getCustomer(customerId);
        } catch (error) {
            console.error("Error getting customer:", error);
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

    // Delete a product
    async deleteProduct(productId) {
        try {
            // Get the product order connections
            const oredrProducts = db.getOrderProductByProductId(productId);

            // Delete order products
            for (op in orderProducts) {
                db.deleteOrderProduct(op.orderId, op.productId);
            }

            // Delete an order

            // Delete a product
            return await db.deleteProduct(productId);
        } catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    },

    // Get a product
    async getProduct(productId) {
        try {
            return await db.getProduct(productId);
        } catch (error) {
            console.error("Error getting product:", error);
            throw error;
        }
    },

    // Update a order product
    async updateOrderProducts(orderId, orderProducts) {
        try {
            // Update order products
            for (op in orderProducts) {
                // Get the product order connection
                const orderProduct = db.getOrderProduct(orderId, op.productId);

                // Update or create the order product
                if (orderProduct !== null) {
                    db.createOrderProduct(orderId, op.productId, op.amount);
                } else {
                    db.updateOrderProduct(orderId, op.productId, op.amount);
                }
            }
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
    },

    // Get all event logs
    async getEventLogs() {
        try {
            return await db.getEventLogs();
        } catch (error) {
            console.error("Error getting event logs:", error);
            throw error;
        }
    }
};
