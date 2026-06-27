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

CREATE TABLE DeliveryCompany (
    deliveryCompanyId INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255),
    zipCode VARCHAR(20),
    price DECIMAL(10,2),
    name VARCHAR(255)
);

CREATE TABLE Delivery (
    deliveryId INT AUTO_INCREMENT PRIMARY KEY,
    productId INT,
    deliveryCompanyId INT,
    amount INT,
    status VARCHAR(20),
    address VARCHAR(255),
    zipCode VARCHAR(20),

    FOREIGN KEY (deliveryCompanyId)
        REFERENCES DeliveryCompany(deliveryCompanyId),

    FOREIGN KEY (productId)
        REFERENCES Product(productId)
);
