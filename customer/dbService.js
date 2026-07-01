const db = require("./dbRepository");

module.exports = {
    // customer

    // Create customer
    async createCustomer(customer) {
        try {
            return await db.createCustomer(customer);
        } catch (error) {
            console.error("Error creating customer:", error);
            throw error;
        }
    },

    // Get customer
    async getCustomer(customerId) {
        try {
            return await db.getCustomer(customerId);
        } catch (error) {
            console.error("Error getting customer:", error);
            throw error;
        }
    },

    // Get all customers
    async getAllCustomers() {
        try {
            return await db.getAllCustomers();
        } catch (error) {
            console.error("Error getting customers:", error);
            throw error;
        }
    },

    // Update customer
    async updateCustomer(customer) {
        try {
            return await db.updateCustomer(customer);
        } catch (error) {
            console.error("Error updating customer:", error);
            throw error;
        }
    },

    // Delete customer
    async deleteCustomer(customerId) {
        try {
            return await db.deleteCustomer(customerId);
        } catch (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    },

    // Import a customer from csv, skipping it if it already exists
    async importCustomerFromCsv(row) {
        try {
            const existing = await db.findCustomerByImportKey(
                row.companyName,
                row.firstName,
                row.lastName,
                row.phoneNumber
            );

            if (existing) {
                return { customer: existing, imported: false };
            }

            const created = await db.createCustomer({
                companyName: row.companyName,
                firstName: row.firstName,
                lastName: row.lastName,
                phoneNumber: row.phoneNumber,
                address: row.address,
                source: "csv_import"
            });

            return { customer: created, imported: true };
        } catch (error) {
            console.error("Error importing customer from CSV:", error);
            throw error;
        }
    },

    // CustomerOrder

    // Record a new order against a customer (triggered by the order_created event)
    async addOrder(customerId, orderId, orderStatus) {
        try {
            const customer = await db.getCustomer(customerId);

            if (!customer) {
                // logging in case the customer table is out of sync
                console.error(
                    `[CustomerService] Received order_created for unknown customerId: ${customerId}` +
                    `Local CustomerServiceDB is out of sync with OrderServiceDB`
                );
                return null;
            }

            return await db.createCustomerOrder(customerId, orderId, orderStatus);
        } catch (error) {
            console.error("Error adding order to customer:", error);
            throw error;
        }
    },

    // Update the status of an order
    async updateOrderStatus(orderId, orderStatus) {
        try {
            return await db.updateCustomerOrderStatus(orderId, orderStatus);
        } catch (error) {
            console.error("Error updating order status:", error);
            throw error;
        }
    },

    // Remove an order
    async removeOrder(orderId) {
        try {
            return await db.deleteCustomerOrder(orderId);
        } catch (error) {
            console.error("Error removing order from customer:", error);
            throw error;
        }
    },

    // Get all orders tracked for a certain customer 
    async getOrdersByCustomerId(customerId) {
        try {
            return await db.getOrdersByCustomerId(customerId);
        } catch (error) {
            console.error("Error getting orders for customer:", error);
            throw error;
        }
    },

    // Get the tracked status of one specific order
    async getOrderStatus(orderId) {
        try {
            return await db.getCustomerOrderByOrderId(orderId);
        } catch (error) {
            console.error("Error getting order status:", error);
            throw error;
        }
    },

    // Tickets

    // Create support ticket
    async createTicket(ticket) {
        try {
            const customer = await db.getCustomer(ticket.customerId);

            if (!customer) {
                throw new Error(`Cannot create ticket: customer ${ticket.customerId} does not exist`);
            }

            return await db.createTicket(ticket);
        } catch (error) {
            console.error("Error creating ticket:", error);
            throw error;
        }
    },

    // Get one ticket
    async getTicket(ticketId) {
        try {
            return await db.getTicket(ticketId);
        } catch (error) {
            console.error("Error getting ticket:", error);
            throw error;
        }
    },

    // Get all tickets for customer
    async getTicketsByCustomerId(customerId) {
        try {
            return await db.getTicketsByCustomerId(customerId);
        } catch (error) {
            console.error("Error getting tickets for customer:", error);
            throw error;
        }
    },

    // Get all tickets
    async getAllTickets() {
        try {
            return await db.getAllTickets();
        } catch (error) {
            console.error("Error getting all tickets:", error);
            throw error;
        }
    },

    // Answer a ticket (cs responds to customer's question)
    async answerTicket(ticketId, response) {
        try {
            return await db.answerTicket(ticketId, response);
        } catch (error) {
            console.error("Error answering ticket:", error);
            throw error;
        }
    },

    // Close a ticket
    async closeTicket(ticketId) {
        try {
            return await db.closeTicket(ticketId);
        } catch (error) {
            console.error("Error closing ticket:", error);
            throw error;
        }
    },

    // EventLogs

    async createEventLog(eventLog) {
        try {
            return await db.createEventLog(eventLog);
        } catch (error) {
            console.error("Error creating event log:", error);
            throw error;
        }
    },

    async getEventLogs() {
        try {
            return await db.getEventLogs();
        } catch (error) {
            console.error("Error getting event logs:", error);
            throw error;
        }
    }
};