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
    FOREIGN KEY (productId) REFERENCES Product(productId)
);

CREATE TABLE Package (
    packageId INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT,
    packageStatus VARCHAR(50)
);

USE OrderServiceDB;

-- Seed Customer table
INSERT INTO Customer (address, zipCode, email)
SELECT 'Rijngraafstraat 66', '4811DL', 'mart@hotmail.com'
WHERE NOT EXISTS (SELECT 1 FROM Customer);

INSERT INTO Customer (address, zipCode, email)
SELECT 'Dokterblondeelhof 4', '3849KG', 'tom@hotmail.com';

INSERT INTO Customer (address, zipCode, email)
SELECT 'Herardlaan', '4578FL', 'margot@hotmail.com';

-- Seed Product table
INSERT INTO Product (name, description)
SELECT 'Laptop', 'High-end gaming laptop'
WHERE NOT EXISTS (SELECT 1 FROM Product);

INSERT INTO Product (name, description)
SELECT 'Football', 'A orange football';

INSERT INTO Product (name, description)
SELECT 'Marker', 'A black permanent marker';

-- Seed Orders table
INSERT INTO Orders (orderStatus, customerId)
SELECT 'Picking prodcuts', 1
WHERE NOT EXISTS (SELECT 1 FROM Orders);

INSERT INTO Orders (orderStatus, customerId)
SELECT 'Picking prodcuts', 2;

-- Seed OrderProduct table
INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 1, 1, 2
WHERE NOT EXISTS (SELECT 1 FROM OrderProduct);

INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 1, 2, 5;

INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 1, 3, 10;

INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 2, 1, 1;

INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 2, 2, 3;

INSERT INTO OrderProduct (orderId, productId, amount)
SELECT 2, 3, 10;

USE WarehouseServiceDB;

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Laptop', 'High-end gaming laptop', 1299.99, 'TechCorp', 50
WHERE NOT EXISTS (SELECT 1 FROM Product);

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Football', 'A orange football', 3.25, 'Nike', 100;

INSERT INTO Product (name, description, price, manufacturer, amountStored)
SELECT 'Marker', 'A black permanent marker', 1, 'Hema', 500;

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

-- ===== PaymentServiceDB (Storm / Payment service) =====
CREATE DATABASE IF NOT EXISTS PaymentServiceDB;

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
