-- ===== Create the databases =====

CREATE DATABASE IF NOT EXISTS OrderServiceDB;
CREATE DATABASE IF NOT EXISTS OrderServiceReadDB;
CREATE DATABASE IF NOT EXISTS WarehouseServiceDB;
CREATE DATABASE IF NOT EXISTS CustomerServiceDB;
CREATE DATABASE IF NOT EXISTS ShippingServiceDB;
CREATE DATABASE IF NOT EXISTS PaymentServiceDB;

-- ===== Create the database tables =====

-- ===== OrderServiceDB =====

USE OrderServiceDB;

CREATE TABLE EventLogs (
    eventLogsId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    date DATETIME,
    data JSON
);


-- ===== OrderServiceReadDB =====

USE OrderServiceReadDB;

CREATE TABLE Orders (
    orderId INT PRIMARY KEY,
    orderStatus VARCHAR(50),
    customerId INT
);

-- ===== WarehouseServiceDB =====

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
    orderId INT,
    productId INT,
    amount INT,
    PRIMARY KEY (orderId, productId),
    FOREIGN KEY (productId) REFERENCES Product(productId)
);

CREATE TABLE Package (
    packageId INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT,
    packageStatus VARCHAR(50)
);

-- ===== CustomerServiceDB =====

USE CustomerServiceDB;


CREATE TABLE Customer (
    customerId INT AUTO_INCREMENT PRIMARY KEY,
    companyName VARCHAR(255),
    firstName VARCHAR(255),
    lastName VARCHAR(255),
    phoneNumber VARCHAR(50),
    address VARCHAR(255),
    source VARCHAR(50) DEFAULT 'manual'
);


CREATE TABLE CustomerOrder (
    orderId INT PRIMARY KEY,
    customerId INT,
    orderStatus VARCHAR(50),
    FOREIGN KEY (customerId) REFERENCES Customer(customerId)
);


CREATE TABLE Ticket (
    ticketId INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT,
    orderId INT NULL,
    subject VARCHAR(255),
    message TEXT,
    status VARCHAR(50) DEFAULT 'open',
    response TEXT NULL,
    createdAt DATETIME,
    updatedAt DATETIME,
    FOREIGN KEY (customerId) REFERENCES Customer(customerId)
);

CREATE TABLE EventLogs (
    eventLogsId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    date DATETIME
);

-- ===== PaymentServiceDB =====

USE PaymentServiceDB;

CREATE TABLE Payment (
    paymentId INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT,
    customerId INT,
    method VARCHAR(20),
    amount DECIMAL(10,2),
    status VARCHAR(50),
    date DATETIME
);

-- ===== ShippingServiceDB =====

USE ShippingServiceDB;


CREATE TABLE Carrier (
    carrierId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    pricePerShipment DECIMAL(10,2)
);


CREATE TABLE Shipment (
    shipmentId INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT,                 
    customerId INT,            
    carrierId INT,
    status VARCHAR(50),         
    trackingCode VARCHAR(100),
    packageWeight DECIMAL(10,2),
    createdAt DATETIME,
    shippedAt DATETIME NULL,
    FOREIGN KEY (carrierId) REFERENCES Carrier(carrierId)
);

CREATE TABLE EventLogs (
    eventLogsId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    date DATETIME
);

-- ===== Insert data =====

-- ===== ShippingServiceDB =====

-- Seed Carrier table
INSERT INTO Carrier (name, pricePerShipment)
SELECT 'PostNL', 5.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'PostNL');

-- ===== WarehouseServiceDB =====

USE WarehouseServiceDB;

-- Seed Product table
INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Laptop', 'High-end gaming laptop', 1299.99, 'TechCorp', 50
WHERE NOT EXISTS (SELECT 1 FROM Product);

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Football', 'A orange football', 3.25, 'Nike', 100;

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Marker', 'A black permanent marker', 1, 'Hema', 500;

-- Seed PickList table
INSERT INTO PickList (orderId, productId, amount)
SELECT 1, 1, 2
WHERE NOT EXISTS (SELECT 1 FROM PickList);

INSERT INTO PickList (orderId, productId, amount)
SELECT 1, 2, 5;

INSERT INTO PickList (orderId, productId, amount)
SELECT 1, 3, 10;

INSERT INTO PickList (orderId, productId, amount)
SELECT 2, 1, 1;

INSERT INTO PickList (orderId, productId, amount)
SELECT 2, 2, 3;

INSERT INTO PickList (orderId, productId, amount)
SELECT 2, 3, 10;

-- ===== CustomerServiceDB =====

USE CustomerServiceDB;

-- ===== PaymentServiceDB =====

USE PaymentServiceDB;

-- Seed Payment table
INSERT INTO Payment (paymentId, orderId, customerId, method, amount, status, date)
SELECT 1, 1, 1, 'IDeal', 2626.23, 'Payed', '2026-06-28 14:34:27';

INSERT INTO Payment (paymentId, orderId, customerId, method, amount, status, date)
SELECT 2, 2, 2, 'IDeal', 1319.74, 'Payed', '2026-06-15 17:48:15';

-- ===== OrderServiceDB =====

USE OrderServiceReadDB;

-- Seed Orders table
INSERT INTO Orders (orderId, orderStatus, customerId)
SELECT 1, 'Picking prodcuts', 1
WHERE NOT EXISTS (SELECT 1 FROM Orders);

INSERT INTO Orders (orderId, orderStatus, customerId)
SELECT 2, 'Picking prodcuts', 2;
