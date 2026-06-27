CREATE DATABASE IF NOT EXISTS OrderServiceDB;
CREATE DATABASE IF NOT EXISTS WarehouseServiceDB;

USE OrderServiceDB;

CREATE TABLE Customer (
    customerId INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255),
    zipCode VARCHAR(20),
    email VARCHAR(255)
);

CREATE TABLE Product (
    productId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT
);

CREATE TABLE Orders (
    orderId INT AUTO_INCREMENT PRIMARY KEY,
    orderStatus VARCHAR(50),
    customerId INT,
    FOREIGN KEY (customerId) REFERENCES Customer(customerId)
);

CREATE TABLE OrderProduct (
    orderId INT,
    productId INT,
    amount INT,
    PRIMARY KEY (orderId, productId),
    FOREIGN KEY (orderId) REFERENCES Orders(orderId),
    FOREIGN KEY (productId) REFERENCES Product(productId)
);

CREATE TABLE EventLogs (
    eventLogsId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    date DATETIME
);

USE WarehouseServiceDB;

CREATE TABLE Product (
    productId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    manufacturer VARCHAR(255),
    amountStored INT
);

CREATE TABLE PickList (
    pickListId INT,
    productId INT,
    amount INT,
    PRIMARY KEY (pickListId, productId),
    FOREIGN KEY (pickListId) REFERENCES PickList(pickListId),
    FOREIGN KEY (productId) REFERENCES Product(productId)
);

USE OrderServiceDB;

-- Seed Customer table
INSERT INTO Customer (address, zipCode, email)
SELECT 'Rijngraafstraat 66', '4811DL', 'mart@hotmail.com'
WHERE NOT EXISTS (SELECT 1 FROM Customer);

-- Seed Product table
INSERT INTO Product (name, description)
SELECT 'Laptop', 'High-end gaming laptop'
WHERE NOT EXISTS (SELECT 1 FROM Product);

-- Seed Orders table
INSERT INTO Orders (orderStatus, customerId)
SELECT 'Order created', 1
WHERE NOT EXISTS (SELECT 1 FROM Orders);

-- Seed OrderProduct table
INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 1, 1, 2
WHERE NOT EXISTS (SELECT 1 FROM OrderProduct);

USE WarehouseServiceDB;

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Laptop', 'High-end gaming laptop', 1299.99, 'TechCorp', 50
WHERE NOT EXISTS (SELECT 1 FROM Product);

INSERT INTO PickList (pickListId, productId, amount)
SELECT 1, 1, 2
WHERE NOT EXISTS (SELECT 1 FROM PickList);
