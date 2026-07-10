CREATE DATABASE IF NOT EXISTS CustomerServiceDB;

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


CREATE DATABASE IF NOT EXISTS ShippingServiceDB;

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


INSERT INTO Carrier (name, pricePerShipment)
SELECT 'PostNL', 5.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'PostNL');

INSERT INTO Carrier (name, pricePerShipment)
SELECT 'DHL', 3.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'DHL');

INSERT INTO Carrier (name, pricePerShipment)
SELECT 'DPD', 4.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'DPD');

INSERT INTO Carrier (name, pricePerShipment)
SELECT 'UPS', 4.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'UPS');