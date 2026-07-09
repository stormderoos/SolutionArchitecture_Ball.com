-- ===== Create the databases =====

CREATE DATABASE IF NOT EXISTS OrderServiceDB;
CREATE DATABASE IF NOT EXISTS OrderServiceReadDB;
CREATE DATABASE IF NOT EXISTS WarehouseServiceDB;
CREATE DATABASE IF NOT EXISTS CustomerServiceDB;
CREATE DATABASE IF NOT EXISTS ShippingServiceDB;
CREATE DATABASE IF NOT EXISTS PaymentServiceDB;
CREATE DATABASE IF NOT EXISTS CatalogServiceDB;

-- ===== Create the database tables =====

-- ===== OrderServiceDB =====

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
    type VARCHAR(50),
    name VARCHAR(255),
    description TEXT,
    date DATETIME,
    data JSON
);

-- Event sourcing: append-only event store for orders (schema owned by init.sql,
-- so the application account only needs DML rights -> principle of least privilege).
CREATE TABLE OrderEvents (
    eventId INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    eventType VARCHAR(50) NOT NULL,
    data JSON,
    createdAt DATETIME NOT NULL
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
    weight DECIMAL(10,2) DEFAULT 0,
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
    date DATETIME,
    -- Idempotency: one payment per order. RabbitMQ is at-least-once, so the
    -- same order event may arrive twice; this constraint stops a duplicate row.
    UNIQUE KEY uq_payment_order (orderId)
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

-- ===== CatalogServiceDB =====

USE CatalogServiceDB;

CREATE TABLE Supplier (
    supplierId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE Product (
    productId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10,2) DEFAULT 0,
    weight DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    manufacturer VARCHAR(255),
    amountStored INT DEFAULT 0
);

CREATE TABLE SupplierProducts (
    supplierId INT,
    productId INT,
    PRIMARY KEY (supplierId, productId)
);

-- Seed catalog tables if empty
INSERT INTO Supplier (name)
SELECT 'Ball Supply Co.' WHERE NOT EXISTS (SELECT 1 FROM Supplier WHERE name = 'Ball Supply Co.');

INSERT INTO Supplier (name)
SELECT 'Sporting Goods BV' WHERE NOT EXISTS (SELECT 1 FROM Supplier WHERE name = 'Sporting Goods BV');

INSERT INTO Supplier (name)
SELECT 'Hydration Partners' WHERE NOT EXISTS (SELECT 1 FROM Supplier WHERE name = 'Hydration Partners');

INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Ball', 9.99, 0.25, 'Standard ball', 'Ball Co', 100 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Ball');

INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Football', 12.99, 0.45, 'Outdoor football', 'Ball Co', 50 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Football');

INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Water bottle', 4.75, 0.30, 'Plastic water bottle', 'Hydration Partners', 200 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Water bottle');

-- Link seeded products to suppliers (best-effort, ignore duplicates)
INSERT INTO SupplierProducts (supplierId, productId)
SELECT s.supplierId, p.productId FROM Supplier s JOIN Product p ON p.name IN ('Ball','Football') AND s.name = 'Ball Supply Co.'
WHERE NOT EXISTS (SELECT 1 FROM SupplierProducts sp WHERE sp.supplierId = s.supplierId AND sp.productId = p.productId);

INSERT INTO SupplierProducts (supplierId, productId)
SELECT s.supplierId, p.productId FROM Supplier s JOIN Product p ON p.name = 'Water bottle' AND s.name = 'Hydration Partners'
WHERE NOT EXISTS (SELECT 1 FROM SupplierProducts sp WHERE sp.supplierId = s.supplierId AND sp.productId = p.productId);

-- ===== Insert data =====

-- ===== ShippingServiceDB =====

USE ShippingServiceDB;

-- Seed Carrier table
INSERT INTO Carrier (name, pricePerShipment)
SELECT 'PostNL', 5.95
WHERE NOT EXISTS (SELECT 1 FROM Carrier WHERE name = 'PostNL');

-- ===== WarehouseServiceDB =====

USE WarehouseServiceDB;

-- Seed Product table
INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Ball', 9.99, 0.25, 'Standard ball', 'Ball Co', 100 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Ball');

INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Football', 12.99, 0.45, 'Outdoor football', 'Ball Co', 50 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Football');

INSERT INTO Product (name, price, weight, description, manufacturer, amountStored)
SELECT 'Water bottle', 4.75, 0.30, 'Plastic water bottle', 'Hydration Partners', 200 WHERE NOT EXISTS (SELECT 1 FROM Product WHERE name = 'Water bottle');

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

-- ===== OrderServiceDB =====

USE OrderServiceDB;

-- ===== Insert the first group of customers into the oder service =====

-- Seed Customer table
INSERT INTO Customer (address, zipCode, email) VALUES
('Jones Mountain 91', '51137', 'heather.brown@asml.com'),
('William Groves 94', '46297', 'joseph.harmon@asml.com'),
('Jeffrey Corners 126', '67248', 'fernando.white@inggroep.com'),
('Mason Mountain 5', '88607', 'stephanie.taylor@philips.com'),
('Johnson Oval 164', '96659', 'melissa.white@inggroep.com'),
('Brian Pike 95', '00795', 'jill.moore@philips.com'),
('Danielle Track 143', '81598', 'david.ortiz@abnamro.com'),
('Joshua Heights 155', '78798', 'tyler.wiggins@kpmg.com'),
('Justin Points 159', '66573', 'alfred.hester@abnamro.com'),
('Tyler Overpass 171', '61514', 'ebony.thomas@asml.com'),
('Hawkins Islands 145', '56790', 'misty.clark@abnamro.com'),
('Miguel Manors 137', '31546', 'courtney.miller@kpmg.com'),
('Scott Fall 95', '70540', 'james.ramsey@dsm.com'),
('Valerie Locks 39', '70561', 'karen.davidson@abnamro.com'),
('Michelle Stream 151', '06238', 'mallory.ruiz@inggroep.com'),
('Dakota Way 96', '87099', 'james.hernandez@royaldutchshell.com'),
('Cole Grove 85', '75683', 'justin.hoffman@asml.com'),
('Jackson Junction 159', '63882', 'rachel.mcguire@asml.com'),
('Randy Run 33', '68773', 'michelle.romero@abnamro.com'),
('Murphy Mountains 133', '53856', 'edward.schultz@kpmg.com'),
('Nicole Squares 113', '02608', 'sean.watts@rabobank.com'),
('Amanda Extension 117', '85547', 'joshua.moore@aholddelhaize.com'),
('Brown Plains 139', '74487', 'bryan.prince@rabobank.com'),
('Allison Court 66', '26469', 'caitlin.castillo@abnamro.com'),
('Hendricks Burgs 91', '79503', 'natasha.gibson@dsm.com'),
('Mary Lodge 106', '44137', 'theresa.martin@abnamro.com'),
('Carson Roads 165', '99930', 'patricia.gilbert@dsm.com'),
('Young Corners 93', '82737', 'joshua.watson@heineken.com'),
('James Lodge 143', '53053', 'brittany.garner@philips.com'),
('Bryant Burgs 79', '79512', 'sarah.anthony@dsm.com'),
('Bond Alley 108', '33347', 'alexander.mendoza@kpmg.com'),
('Cox View 27', '06222', 'mary.mccoy@philips.com'),
('Rice Fork 187', '75586', 'ronald.hernandez@dsm.com'),
('Beth Loaf 23', '90805', 'james.jones@philips.com'),
('Tiffany Mountain 161', '68578', 'sean.miller@royaldutchshell.com'),
('Hunt Turnpike 44', '40917', 'stephanie.lowe@aholddelhaize.com'),
('Robert Island 116', '55060', 'angela.adams@philips.com'),
('Kevin Branch 176', '20631', 'tamara.sutton@philips.com'),
('Morgan Square 48', '14793', 'bailey.andrews@dsm.com'),
('Bailey Streets 89', '31334', 'david.myers@aholddelhaize.com'),
('Jasmine Point 34', '81897', 'nicholas.jarvis@heineken.com'),
('Logan Circle 175', '01810', 'christopher.holt@abnamro.com'),
('Sonia Mews 88', '97762', 'jeff.carter@asml.com'),
('Johnson Rapid 191', '36506', 'timothy.peterson@philips.com'),
('Mckenzie Parkway 126', '31065', 'ashlee.marquez@inggroep.com'),
('Shannon Burgs 30', '37132', 'john.mcdaniel@abnamro.com'),
('Anderson Well 98', '38749', 'daniel.hahn@kpmg.com'),
('Robert Ridge 64', '43774', 'kimberly.evans@asml.com'),
('Ryan Avenue 34', '67150', 'omar.simpson@philips.com'),
('Jason Locks 26', '02544', 'brett.west@asml.com'),
('Jermaine Heights 63', '04026', 'janet.huffman@royaldutchshell.com'),
('Frank Junctions 135', '29545', 'melissa.stokes@aholddelhaize.com'),
('Wilson Lights 62', '66639', 'patrick.smith@kpmg.com'),
('Yvonne Lodge 15', '18877', 'julia.williams@heineken.com'),
('Lee Views 152', '03582', 'patrick.lopez@asml.com'),
('Kenneth Corner 117', '48292', 'jennifer.moore@philips.com'),
('Kristina Ridges 49', '77863', 'joseph.price@kpmg.com'),
('Hawkins Divide 7', '18559', 'eric.wilson@dsm.com'),
('Ruiz Prairie 77', '00813', 'jacqueline.allen@inggroep.com'),
('Gray Union 25', '91887', 'eric.french@kpmg.com'),
('Andrews Ferry 79', '58404', 'brian.murray@philips.com'),
('Williams Mission 23', '47195', 'christina.williams@asml.com'),
('Teresa Cove 166', '63799', 'elizabeth.robles@kpmg.com'),
('Kramer Skyway 196', '09682', 'kristin.santiago@asml.com'),
('Powers Square 137', '35423', 'elizabeth.johnson@philips.com'),
('Julie Burg 87', '76735', 'kevin.li@kpmg.com'),
('Mack Harbor 94', '76618', 'shawn.matthews@asml.com'),
('Theresa Parkways 72', '84160', 'rebecca.lane@rabobank.com'),
('Reynolds Points 184', '75078', 'amanda.miller@royaldutchshell.com'),
('Natalie Corner 173', '69622', 'maria.hughes@aholddelhaize.com'),
('Randall Motorway 141', '27046', 'daniel.bass@inggroep.com'),
('Scott Skyway 200', '52722', 'cody.murray@kpmg.com'),
('Coleman Prairie 187', '91880', 'kimberly.scott@kpmg.com'),
('Johnson Islands 185', '71695', 'jaime.meyer@aholddelhaize.com'),
('Sherri Station 82', '34153', 'alexander.hall@inggroep.com'),
('Moore Course 196', '86152', 'kathleen.brown@kpmg.com'),
('Regina Causeway 172', '47179', 'latoya.davis@heineken.com'),
('Herring Street 166', '84083', 'william.maldonado@rabobank.com'),
('Natalie Alley 8', '81890', 'jacob.stephens@heineken.com'),
('Rodriguez Lane 93', '04613', 'caitlin.combs@philips.com'),
('Kayla Unions 62', '80906', 'dennis.zimmerman@royaldutchshell.com'),
('Lorraine Islands 129', '88536', 'ashley.morgan@abnamro.com'),
('James Burgs 127', '54846', 'amber.roberts@royaldutchshell.com'),
('Garcia Underpass 112', '46353', 'julie.white@kpmg.com'),
('Garcia Crest 127', '47657', 'joseph.henderson@heineken.com'),
('Contreras Gardens 175', '11371', 'john.murphy@rabobank.com'),
('Brown Coves 28', '11270', 'desiree.hughes@royaldutchshell.com'),
('Brian Village 82', '52756', 'stephanie.crawford@aholddelhaize.com'),
('Ryan Lights 50', '32202', 'tanya.roberts@rabobank.com'),
('Patrick Park 66', '61866', 'samuel.moore@asml.com'),
('Villa Stravenue 118', '73436', 'david.taylor@aholddelhaize.com'),
('Stephanie Vista 49', '09126', 'michelle.caldwell@dsm.com'),
('Garrett Trail 158', '91156', 'jordan.hall@kpmg.com'),
('Oscar Road 191', '93404', 'eric.wright@dsm.com'),
('Scott Viaduct 127', '83256', 'debra.caldwell@kpmg.com'),
('David Village 175', '67846', 'vicki.houston@asml.com'),
('Peck Lake 167', '27990', 'george.wright@heineken.com'),
('Luna Drives 63', '26350', 'megan.harris@royaldutchshell.com'),
('Robert Harbor 27', '21332', 'fernando.morales@asml.com'),
('Keller Mount 198', '85160', 'barbara.green@dsm.com'),
('Christine Passage 34', '19787', 'eric.harris@asml.com'),
('Jack Freeway 187', '99563', 'stephanie.bennett@aholddelhaize.com'),
('Hall Prairie 86', '70519', 'james.alexander@asml.com'),
('Jennifer Islands 153', '58363', 'george.mack@rabobank.com'),
('Smith Corner 169', '56019', 'sarah.mercer@kpmg.com'),
('Mike Throughway 183', '29773', 'cheryl.allen@kpmg.com'),
('Phillips Stravenue 31', '85098', 'wendy.simon@abnamro.com'),
('Santiago Radial 81', '10556', 'ruben.castillo@heineken.com'),
('Michelle Lake 31', '04427', 'william.morgan@asml.com'),
('Hart Circles 151', '19015', 'jonathan.vasquez@royaldutchshell.com'),
('Smith Avenue 179', '90738', 'grace.jones@dsm.com'),
('Murphy Islands 162', '29101', 'karen.smith@philips.com'),
('Taylor Ranch 128', '34136', 'heather.boyd@abnamro.com'),
('Estrada Alley 83', '59618', 'nicholas.hansen@aholddelhaize.com'),
('Fritz Loop 139', '35027', 'cheyenne.morgan@kpmg.com'),
('Bennett Causeway 103', '69867', 'charles.hess@heineken.com'),
('Patton Isle 91', '61457', 'jason.taylor@philips.com'),
('Hodge Wall 15', '01516', 'patrick.martin@philips.com'),
('James Islands 72', '51017', 'michael.swanson@asml.com'),
('Victor Cliffs 102', '60835', 'matthew.crane@heineken.com'),
('Melissa Falls 111', '27698', 'adam.jenkins@kpmg.com'),
('Wood Stravenue 90', '01931', 'jeremy.ross@royaldutchshell.com'),
('Barrett Centers 145', '60056', 'deanna.baker@philips.com'),
('Thomas Mall 59', '97074', 'katherine.murphy@kpmg.com'),
('Jennifer Cliff 180', '02207', 'kaitlyn.walters@rabobank.com'),
('Williams Freeway 48', '19969', 'jason.poole@asml.com'),
('Sharp Plain 147', '48727', 'william.daniels@inggroep.com'),
('Washington Spur 25', '29265', 'jason.huerta@heineken.com'),
('Wallace Place 89', '08719', 'audrey.johnson@royaldutchshell.com'),
('Miller Harbor 165', '08199', 'christine.johnson@kpmg.com'),
('Rodriguez Dale 122', '94035', 'deanna.flowers@dsm.com'),
('Kyle Orchard 199', '25726', 'douglas.thompson@dsm.com'),
('Shane Pine 149', '39708', 'suzanne.hendricks@heineken.com'),
('Vicki Estates 68', '67500', 'melissa.lowe@philips.com'),
('Evan Stravenue 134', '54354', 'ashley.mcpherson@rabobank.com'),
('Rachel Track 59', '64882', 'corey.walker@rabobank.com'),
('Cain Brooks 146', '47391', 'scott.heath@kpmg.com'),
('Thomas Haven 183', '89166', 'gary.coleman@kpmg.com'),
('Ronald Spurs 144', '09719', 'stephanie.stewart@kpmg.com'),
('Claudia Junctions 122', '84950', 'christian.smith@aholddelhaize.com'),
('Anderson Loaf 196', '76134', 'david.jones@kpmg.com'),
('Peters Valley 62', '55330', 'lisa.johnson@abnamro.com'),
('Melissa Shores 18', '49865', 'ryan.huang@asml.com'),
('Price Fall 187', '43712', 'mark.grant@kpmg.com'),
('Lisa Camp 11', '52462', 'emily.owens@aholddelhaize.com'),
('Amy Spring 31', '71249', 'michelle.singh@aholddelhaize.com'),
('Christopher Route 9', '33193', 'george.davis@royaldutchshell.com'),
('Gross Turnpike 91', '79665', 'charles.perez@philips.com'),
('Katherine Locks 84', '26859', 'carla.olson@royaldutchshell.com'),
('Katelyn Landing 150', '29545', 'david.caldwell@royaldutchshell.com'),
('Myers Bypass 181', '62537', 'michelle.williamson@philips.com'),
('Dawn Spring 140', '60632', 'kathleen.benjamin@kpmg.com'),
('Parker Trace 75', '42086', 'brittany.rios@abnamro.com'),
('Pierce Prairie 78', '92749', 'patrick.hunt@kpmg.com'),
('Robertson Corners 11', '96798', 'felicia.thomas@heineken.com'),
('Misty Common 25', '81328', 'felicia.johnson@royaldutchshell.com'),
('Anthony Villages 102', '34395', 'kaitlyn.klein@dsm.com'),
('Webb Branch 183', '23918', 'sean.carey@inggroep.com'),
('Earl Forges 159', '42792', 'brianna.martin@abnamro.com'),
('Zimmerman Ramp 134', '90049', 'alicia.cooper@heineken.com'),
('Nichole Mountain 114', '87916', 'john.burns@abnamro.com'),
('Morrow Wall 63', '28440', 'valerie.west@kpmg.com'),
('Price Trafficway 69', '15277', 'aaron.cline@inggroep.com'),
('Melissa Isle 128', '10077', 'ashley.anderson@aholddelhaize.com'),
('Johnson Greens 105', '51722', 'jodi.smith@heineken.com'),
('West Alley 187', '54995', 'nicholas.burns@asml.com'),
('Carney Stream 179', '09389', 'brian.cook@dsm.com'),
('Sabrina Brook 57', '60877', 'jessica.franklin@abnamro.com'),
('Barry Bridge 62', '01363', 'aaron.moore@abnamro.com'),
('Moore Extension 167', '74738', 'angel.ingram@aholddelhaize.com'),
('Cordova Mountains 162', '05118', 'rachel.may@kpmg.com'),
('Wilkerson Forest 164', '70508', 'rhonda.pham@philips.com'),
('Ashley Rest 9', '08112', 'stephanie.richardson@aholddelhaize.com'),
('Kenneth Ford 63', '38387', 'randall.davis@asml.com'),
('Simmons Canyon 171', '73097', 'ronald.farmer@aholddelhaize.com'),
('Bates Plaza 95', '25613', 'deborah.craig@inggroep.com'),
('Matthew Unions 68', '85459', 'adrian.wood@royaldutchshell.com'),
('Joseph Course 39', '61537', 'brian.oconnor@kpmg.com'),
('Barron Village 22', '66134', 'terry.thompson@dsm.com'),
('Freeman Mews 8', '06835', 'marie.shepard@kpmg.com'),
('Jon Ferry 137', '01144', 'jimmy.atkinson@royaldutchshell.com'),
('Christopher Glens 101', '51820', 'william.mcneil@heineken.com'),
('Jennifer Divide 162', '88543', 'janice.lawson@kpmg.com'),
('Michelle Spurs 141', '42547', 'glenda.finley@inggroep.com'),
('Benjamin Hill 27', '65953', 'traci.jones@dsm.com'),
('Teresa Harbor 46', '15091', 'troy.ramos@abnamro.com'),
('Erin Plaza 118', '16467', 'raymond.johnson@dsm.com'),
('Peters Causeway 65', '31846', 'marie.collier@royaldutchshell.com'),
('Guzman Cove 3', '26019', 'melissa.williams@heineken.com'),
('Anderson Pine 122', '42894', 'anna.carrillo@heineken.com'),
('Kristy Mountain 86', '45232', 'hannah.rasmussen@abnamro.com'),
('Rhonda Centers 188', '00841', 'linda.cherry@heineken.com'),
('Derek Coves 160', '36148', 'scott.castro@inggroep.com'),
('Baker Estate 71', '12553', 'jessica.keller@philips.com'),
('Jessica Square 12', '32626', 'william.williams@abnamro.com'),
('Melanie Burgs 128', '00844', 'richard.robinson@heineken.com'),
('Austin Wells 78', '83979', 'renee.caldwell@kpmg.com'),
('Navarro Vista 37', '34712', 'john.nguyen@royaldutchshell.com'),
('Lowe Overpass 2', '33919', 'james.sutton@kpmg.com'),
('Joshua Radial 193', '11474', 'terri.perez@asml.com'),
('Larson Row 106', '60187', 'anne.copeland@rabobank.com'),
('Edward Groves 138', '50546', 'mary.rasmussen@aholddelhaize.com'),
('Kyle Brook 189', '12543', 'denise.rice@heineken.com'),
('Camacho Corner 59', '20871', 'david.sanchez@royaldutchshell.com'),
('Cook Mission 19', '90553', 'lisa.roberts@heineken.com'),
('Wells Bypass 116', '98222', 'kathleen.mcfarland@heineken.com'),
('Fowler Village 177', '44651', 'matthew.lynch@asml.com'),
('Gary Corner 57', '44631', 'dawn.velez@heineken.com'),
('Bradley Meadows 107', '76450', 'robert.davis@abnamro.com'),
('Barrett Lodge 2', '50591', 'brenda.riddle@kpmg.com'),
('Michael Spur 79', '08542', 'jessica.padilla@rabobank.com'),
('John Loop 93', '62538', 'amy.robinson@philips.com'),
('Mccullough Loop 99', '34311', 'james.romero@dsm.com'),
('Montgomery Route 200', '48108', 'kyle.byrd@philips.com'),
('Amy Island 153', '86535', 'brianna.harmon@asml.com'),
('Lee Ridges 96', '88686', 'mary.rose@asml.com'),
('Kimberly Course 4', '42702', 'charles.foster@kpmg.com'),
('Estrada Way 165', '20398', 'linda.robinson@philips.com'),
('Gregory Glen 39', '96934', 'timothy.noble@heineken.com'),
('Brown Stravenue 48', '27421', 'cristina.sanders@kpmg.com'),
('Hutchinson Curve 113', '20260', 'abigail.brown@abnamro.com'),
('Eddie Ridge 48', '61615', 'stacey.jarvis@rabobank.com'),
('Watson Path 142', '16856', 'adrian.smith@philips.com'),
('Sanchez Lane 129', '15675', 'sharon.spencer@rabobank.com'),
('Brandon View 60', '88916', 'james.white@rabobank.com'),
('Jeffrey Trail 112', '97671', 'megan.allen@philips.com'),
('Kenneth Mills 119', '93221', 'christopher.briggs@asml.com'),
('Jennifer Summit 160', '99142', 'curtis.thompson@kpmg.com'),
('Smith Ports 46', '71090', 'judy.williams@aholddelhaize.com'),
('Hopkins Tunnel 88', '54456', 'jillian.rodriguez@royaldutchshell.com'),
('Anderson Greens 92', '77849', 'jeffrey.reid@inggroep.com'),
('Lauren Villages 32', '03738', 'alison.harris@philips.com'),
('Gray Centers 29', '79364', 'reginald.reid@philips.com'),
('Larry Corners 183', '23282', 'jennifer.jacobson@abnamro.com'),
('Alvarez Tunnel 35', '63730', 'randy.ryan@asml.com'),
('Brown Route 87', '59613', 'brandy.mathews@inggroep.com'),
('Derek Walks 74', '47873', 'karen.cook@kpmg.com'),
('Benjamin Greens 165', '84975', 'madeline.maldonado@kpmg.com'),
('Olivia Crescent 98', '97812', 'kelly.chandler@rabobank.com'),
('Stevenson Court 25', '39698', 'cynthia.kelly@philips.com'),
('Susan Landing 16', '63741', 'patricia.mitchell@heineken.com'),
('Angela Trafficway 170', '97316', 'joshua.richardson@royaldutchshell.com'),
('Joseph Lakes 70', '70196', 'allison.romero@aholddelhaize.com'),
('Connie Valleys 115', '19162', 'lawrence.webster@inggroep.com'),
('Steven Mission 199', '13280', 'russell.melton@heineken.com'),
('Fox Gateway 42', '93982', 'robert.sanders@kpmg.com'),
('Garcia Fields 59', '03451', 'olivia.hall@kpmg.com'),
('Smith Meadow 78', '52235', 'sydney.roth@kpmg.com'),
('Elliott Trafficway 54', '82283', 'andre.pugh@kpmg.com'),
('Sarah Freeway 111', '50757', 'kelly.wolfe@inggroep.com'),
('Janice Plain 129', '20657', 'melissa.sanchez@abnamro.com'),
('Kim Camp 67', '38523', 'karen.scott@abnamro.com'),
('Warren Prairie 193', '23798', 'valerie.gonzalez@heineken.com'),
('Heather Extensions 77', '23979', 'charles.howell@dsm.com'),
('Baker Crest 53', '00836', 'kristin.johnson@rabobank.com'),
('Nelson Greens 101', '52041', 'regina.moses@dsm.com'),
('Henry Stravenue 191', '53604', 'lori.black@philips.com'),
('John Alley 178', '97579', 'deanna.day@kpmg.com'),
('Cynthia Coves 15', '78679', 'sandra.johnson@rabobank.com'),
('Lopez Springs 75', '36575', 'charles.williamson@abnamro.com'),
('Owens Island 141', '12337', 'tara.bryant@aholddelhaize.com'),
('Veronica Circle 79', '23556', 'kristy.weaver@aholddelhaize.com'),
('Young Ridge 106', '50894', 'eric.wilkinson@inggroep.com'),
('Cruz Rapids 98', '65520', 'stacy.harvey@philips.com'),
('Blevins Shores 150', '68001', 'ethan.jimenez@dsm.com'),
('Michael Highway 121', '20232', 'emily.arnold@aholddelhaize.com'),
('Holly Vista 39', '38912', 'samantha.thompson@asml.com'),
('James Summit 30', '63267', 'pamela.scott@abnamro.com'),
('Susan Junctions 163', '72161', 'jorge.rios@kpmg.com'),
('Bryant Circle 106', '45619', 'diane.harrison@asml.com'),
('Miranda Crossing 98', '25820', 'daniel.duran@inggroep.com'),
('Ware Village 70', '15410', 'traci.cisneros@dsm.com'),
('Michelle Way 69', '83082', 'alan.smith@aholddelhaize.com'),
('Roberta Grove 119', '59305', 'leslie.carson@aholddelhaize.com'),
('Murray Tunnel 186', '36323', 'jonathan.salinas@kpmg.com'),
('Sara Courts 6', '42167', 'kelly.brennan@asml.com'),
('James Forks 83', '16812', 'april.ellis@rabobank.com'),
('Meyer Bridge 121', '56690', 'darren.simmons@philips.com'),
('Samantha Land 47', '19759', 'angela.jefferson@inggroep.com'),
('Mario Turnpike 89', '25837', 'timothy.james@heineken.com'),
('Sims Hill 160', '58459', 'ruben.perez@inggroep.com'),
('Barrett Hills 188', '09014', 'henry.carter@kpmg.com'),
('Sandra Pines 4', '47334', 'sophia.edwards@philips.com'),
('Crystal Lodge 10', '50926', 'rachel.lee@dsm.com'),
('Bishop Fork 120', '31541', 'lynn.calhoun@kpmg.com'),
('Washington Plains 136', '37024', 'donald.powell@kpmg.com'),
('Perez Fort 157', '91415', 'jack.buchanan@inggroep.com'),
('Smith Points 178', '38227', 'jill.miranda@abnamro.com'),
('Molly Crossing 66', '83928', 'joy.rodriguez@asml.com'),
('Darryl Station 74', '14773', 'steven.lozano@dsm.com'),
('Victor Extension 33', '66027', 'glen.adams@abnamro.com'),
('Lozano Centers 58', '40189', 'katherine.davis@dsm.com'),
('Troy Shores 108', '43339', 'scott.foley@kpmg.com'),
('Luis Orchard 177', '59336', 'alexander.moreno@dsm.com'),
('Waters Loop 82', '04552', 'dakota.hamilton@inggroep.com'),
('Mcdonald Passage 72', '18512', 'julie.peterson@heineken.com'),
('Preston Shoal 59', '70279', 'stephanie.willis@kpmg.com'),
('Reed Circles 86', '12103', 'blake.wright@rabobank.com'),
('Melissa Spurs 70', '65215', 'matthew.juarez@heineken.com'),
('Jennifer Stream 30', '99030', 'laura.andrews@inggroep.com'),
('Rebecca Path 149', '81868', 'tami.browning@rabobank.com'),
('David Road 101', '42407', 'ana.becker@kpmg.com'),
('Herrera Locks 31', '76719', 'steven.martin@dsm.com'),
('Gordon Ports 49', '33239', 'rachel.scott@abnamro.com'),
('Angelica Brook 83', '19538', 'sean.castillo@aholddelhaize.com'),
('Brewer Court 26', '09691', 'shelby.green@rabobank.com'),
('Ross Walk 153', '56570', 'william.salazar@kpmg.com'),
('Castillo Trafficway 29', '45424', 'wayne.wood@dsm.com'),
('Matthew Landing 16', '88808', 'philip.newman@kpmg.com'),
('Kristin Valley 89', '16395', 'maria.ward@dsm.com'),
('Wright Garden 57', '12997', 'bradley.manning@kpmg.com'),
('Evelyn Ramp 25', '50637', 'miguel.brown@philips.com'),
('Richard Village 11', '57575', 'jose.aguirre@philips.com'),
('Miller Camp 130', '30730', 'darlene.luna@asml.com'),
('Hernandez Radial 131', '14512', 'john.campbell@royaldutchshell.com'),
('Anthony Point 7', '87812', 'amanda.potter@royaldutchshell.com'),
('Obrien Light 160', '92649', 'brandon.diaz@royaldutchshell.com'),
('Susan Estates 184', '86800', 'angela.huang@dsm.com'),
('Kristin Stream 197', '50175', 'edward.frederick@dsm.com'),
('Dougherty Dam 182', '13705', 'hannah.norris@philips.com'),
('Kristen Spur 69', '74647', 'andrea.brewer@rabobank.com'),
('Todd Avenue 43', '21162', 'joan.wolfe@heineken.com'),
('Leah Cove 23', '63032', 'michael.anderson@asml.com'),
('Corey Mission 88', '40447', 'sarah.mccann@heineken.com'),
('Robert Run 127', '43179', 'ashley.garcia@aholddelhaize.com'),
('Maria Glens 101', '95829', 'jeffrey.jefferson@inggroep.com'),
('Emily Key 103', '00931', 'paul.rivera@rabobank.com'),
('Rodriguez Village 153', '66407', 'patricia.reed@philips.com'),
('Derrick Mountain 32', '16475', 'emily.bond@heineken.com'),
('Edward Streets 170', '24219', 'garrett.thompson@asml.com'),
('Bell Brooks 194', '62981', 'brian.rodriguez@inggroep.com'),
('Christopher Tunnel 26', '40858', 'michael.johnson@philips.com'),
('Blair Turnpike 72', '97734', 'anthony.harper@abnamro.com'),
('Tammy Drives 31', '42145', 'joshua.huff@heineken.com'),
('Kaufman Mews 1', '83981', 'isaac.duncan@aholddelhaize.com'),
('Andrew Heights 164', '83020', 'timothy.harris@rabobank.com'),
('Johnson Valleys 73', '33607', 'marcus.fitzgerald@aholddelhaize.com'),
('Ramos Street 62', '70539', 'marie.hicks@rabobank.com'),
('Anne Knoll 123', '80980', 'ryan.edwards@kpmg.com'),
('Vargas Shoal 80', '49814', 'william.thompson@philips.com'),
('Alan Pass 160', '63394', 'jennifer.olson@asml.com'),
('Joseph Parks 101', '03512', 'amber.reed@asml.com'),
('Blackwell Tunnel 82', '01417', 'matthew.robinson@philips.com'),
('Dawn Mountain 176', '73289', 'veronica.smith@abnamro.com'),
('Norton Cliff 195', '26694', 'david.valencia@heineken.com'),
('David Mission 196', '45149', 'matthew.rodriguez@philips.com'),
('Jackson Lodge 196', '53846', 'brianna.melton@asml.com'),
('Hernandez Walk 115', '60691', 'brandon.schaefer@aholddelhaize.com'),
('Donna Mountains 44', '39028', 'jeffrey.lloyd@rabobank.com'),
('Miller Point 149', '76682', 'tracy.gray@asml.com'),
('Ryan Knolls 114', '71906', 'alan.daugherty@inggroep.com'),
('Nichols Highway 147', '11344', 'lori.warren@philips.com'),
('Connie Motorway 45', '35101', 'jacob.gonzalez@rabobank.com'),
('White Dam 110', '65188', 'amy.stephens@heineken.com'),
('Tara Islands 64', '07573', 'michael.chavez@inggroep.com'),
('Ashley Gateway 110', '06568', 'autumn.wilson@rabobank.com'),
('York Viaduct 68', '93079', 'autumn.brown@kpmg.com'),
('Harris Ridge 12', '05727', 'terri.charles@rabobank.com'),
('Gina Coves 144', '61731', 'whitney.wilcox@heineken.com'),
('Jesse Plains 55', '65260', 'kim.mills@royaldutchshell.com'),
('Ethan Fields 50', '75818', 'john.beasley@abnamro.com'),
('Santos Pike 79', '27457', 'joy.weber@kpmg.com'),
('Scott Plaza 185', '69463', 'samuel.lang@aholddelhaize.com'),
('Thomas Court 143', '33251', 'jason.gilbert@aholddelhaize.com'),
('White Squares 181', '52778', 'victor.mcgee@asml.com'),
('William Glens 170', '47031', 'andrea.alvarez@rabobank.com'),
('Taylor Trace 154', '45194', 'debra.morrison@inggroep.com'),
('Amy Falls 165', '93205', 'suzanne.vargas@abnamro.com'),
('Johnson Throughway 41', '95218', 'sara.serrano@inggroep.com'),
('Moreno Ports 23', '20369', 'megan.harris@aholddelhaize.com'),
('Dominguez Canyon 126', '22732', 'sean.larson@aholddelhaize.com'),
('Jacob Crest 100', '94693', 'steven.lewis@heineken.com'),
('Harrison Plains 171', '22656', 'gary.gray@philips.com'),
('Meghan Orchard 21', '23102', 'paul.esparza@rabobank.com'),
('Ronald Courts 169', '90202', 'john.gonzalez@asml.com'),
('Kenneth Loop 37', '78103', 'kevin.hamilton@abnamro.com'),
('Jason Burgs 109', '08920', 'christopher.smith@dsm.com'),
('Farrell Crescent 157', '85495', 'christopher.hernandez@royaldutchshell.com'),
('Hurst Mountains 12', '07036', 'brittany.boone@royaldutchshell.com'),
('John Harbors 63', '87071', 'brian.moore@royaldutchshell.com'),
('Davenport Village 75', '40916', 'kristen.turner@kpmg.com'),
('Lee Shores 125', '89274', 'nicole.michael@asml.com'),
('Wheeler Prairie 145', '39905', 'william.cook@rabobank.com'),
('Neal Rue 176', '02483', 'scott.andrews@heineken.com'),
('Tammy River 31', '91051', 'caleb.hughes@kpmg.com'),
('Wilcox Junction 33', '20637', 'joshua.burke@rabobank.com'),
('Gregory Row 50', '36190', 'richard.dunn@heineken.com'),
('Sean Lights 164', '95023', 'ryan.johnson@rabobank.com'),
('Daniel Road 160', '74379', 'susan.reyes@royaldutchshell.com'),
('Vincent Points 37', '36959', 'jared.lewis@philips.com'),
('Daniel Mill 18', '38543', 'ann.brown@dsm.com'),
('Hardin Corner 15', '42858', 'sally.rodgers@heineken.com'),
('Stephenson Way 61', '36464', 'randall.mcdaniel@dsm.com'),
('Destiny Rest 46', '01038', 'james.garner@inggroep.com'),
('Heath Via 46', '54811', 'amy.gibson@royaldutchshell.com'),
('Weber Heights 195', '81120', 'donald.huynh@kpmg.com'),
('Jeffrey Bypass 111', '33127', 'sarah.perry@asml.com'),
('Butler Flat 159', '49978', 'kyle.turner@dsm.com'),
('Thomas Groves 67', '16743', 'melissa.mejia@rabobank.com'),
('Jeremiah Pine 11', '59613', 'richard.duran@heineken.com'),
('Johnson Rue 109', '72614', 'brittany.miller@royaldutchshell.com'),
('Hodges Springs 67', '80682', 'stephanie.williamson@aholddelhaize.com'),
('Brennan Hollow 69', '43618', 'brian.smith@aholddelhaize.com'),
('Scott Lock 61', '45538', 'jonathan.cunningham@inggroep.com'),
('Pacheco Village 103', '40993', 'john.martin@aholddelhaize.com'),
('Kelly Landing 26', '31087', 'eric.schultz@aholddelhaize.com'),
('Mary Curve 61', '85390', 'zachary.fisher@dsm.com'),
('Kenneth Village 10', '15723', 'cheryl.flores@royaldutchshell.com'),
('Jennifer Square 157', '48053', 'raymond.peters@kpmg.com'),
('Stephanie Mill 83', '63985', 'tamara.liu@philips.com'),
('Cook Crescent 27', '53447', 'william.edwards@kpmg.com'),
('Greene Center 141', '52669', 'david.anderson@dsm.com'),
('Allison Skyway 93', '26491', 'teresa.hunter@abnamro.com'),
('Michele Locks 189', '59210', 'billy.reed@royaldutchshell.com'),
('Katherine Prairie 3', '31653', 'cathy.hardy@kpmg.com'),
('Mitchell Junction 29', '41965', 'samantha.gray@kpmg.com'),
('Elizabeth Fords 135', '41624', 'michael.evans@rabobank.com'),
('Christopher Passage 139', '19263', 'elizabeth.hart@heineken.com'),
('Carrie Mews 30', '99786', 'brent.armstrong@philips.com'),
('Anderson Shoal 89', '42930', 'mary.young@dsm.com'),
('Garcia Fall 129', '71395', 'zachary.bullock@kpmg.com'),
('Williams Corners 115', '37659', 'maria.bowers@abnamro.com'),
('Victor Hill 116', '67643', 'marcus.barber@abnamro.com'),
('Boyd Shores 21', '84451', 'daniel.fields@heineken.com'),
('Tucker Brooks 38', '20383', 'john.gonzales@inggroep.com'),
('Figueroa Pike 21', '14952', 'jennifer.smith@kpmg.com'),
('Zamora Coves 117', '03834', 'ana.gamble@aholddelhaize.com'),
('Smith Knolls 92', '45012', 'samuel.franklin@philips.com'),
('Fox Keys 187', '36191', 'sally.brown@rabobank.com'),
('Jennifer Highway 50', '94016', 'melanie.mason@abnamro.com'),
('Sarah Points 67', '68298', 'keith.sullivan@rabobank.com'),
('Jermaine Stream 93', '40014', 'katherine.sanchez@heineken.com'),
('Banks View 161', '87469', 'karen.khan@royaldutchshell.com'),
('Brittney Harbors 118', '90689', 'valerie.williamson@abnamro.com'),
('Juarez Path 181', '11749', 'eric.jones@kpmg.com'),
('Joshua Garden 92', '10635', 'brenda.estes@abnamro.com'),
('Herrera Groves 102', '97540', 'lauren.frazier@philips.com'),
('Powell Mall 41', '73136', 'ashley.adkins@rabobank.com'),
('Lopez Cliffs 118', '25008', 'alexa.andrews@dsm.com'),
('Pena Ville 174', '78676', 'albert.lopez@abnamro.com'),
('Hannah Hill 128', '26282', 'megan.campbell@kpmg.com'),
('Fletcher Stream 184', '07083', 'robert.castro@dsm.com'),
('Paul Roads 122', '55912', 'sandra.gardner@asml.com'),
('Kemp Falls 165', '57259', 'julie.fernandez@rabobank.com'),
('Deborah Drives 105', '35166', 'cassie.evans@heineken.com'),
('Singleton Stravenue 114', '57278', 'barbara.allen@dsm.com'),
('Robinson Crest 8', '14374', 'scott.stanley@asml.com'),
('Nicholas Courts 70', '48392', 'barbara.thomas@royaldutchshell.com'),
('Carlos Circles 118', '33160', 'jason.heath@rabobank.com'),
('Rush Glens 135', '35991', 'kaitlin.smith@aholddelhaize.com'),
('Freeman River 80', '25750', 'erin.morris@inggroep.com'),
('Tim Summit 133', '77609', 'thomas.robinson@aholddelhaize.com'),
('David Highway 3', '47431', 'diane.maddox@abnamro.com'),
('Contreras Stream 27', '53381', 'christopher.doyle@inggroep.com'),
('Mueller Tunnel 153', '50102', 'thomas.cowan@kpmg.com'),
('Wood Ports 62', '73339', 'ashley.meyer@rabobank.com'),
('Grant Estate 34', '02907', 'zachary.johnson@royaldutchshell.com'),
('Johnson Drive 121', '27752', 'kevin.garrison@philips.com'),
('Kristy Ramp 85', '22904', 'jessica.golden@abnamro.com'),
('Christopher River 152', '60035', 'stephen.aguirre@inggroep.com'),
('Bryan Curve 21', '59581', 'anthony.johnson@royaldutchshell.com'),
('Murphy Squares 80', '97532', 'joshua.wood@dsm.com'),
('Bauer Road 126', '22844', 'angela.mccormick@kpmg.com'),
('Fuentes Stream 56', '15021', 'scott.chavez@abnamro.com'),
('Fowler Mountain 109', '42908', 'joanne.butler@rabobank.com'),
('Friedman Highway 199', '33493', 'adam.richardson@rabobank.com'),
('Paige Mall 188', '79687', 'jim.sullivan@heineken.com'),
('Andrew Lake 71', '98456', 'travis.chambers@aholddelhaize.com'),
('Jennifer Roads 186', '39148', 'michele.lam@kpmg.com'),
('Keith Trail 186', '54074', 'sherry.rasmussen@royaldutchshell.com'),
('Pham Square 185', '18342', 'timothy.wilson@asml.com'),
('Nguyen Branch 20', '62327', 'megan.ortega@rabobank.com'),
('Alex Hill 199', '18436', 'leah.phillips@rabobank.com'),
('Perry Prairie 199', '45056', 'michelle.brooks@kpmg.com'),
('Randall Inlet 143', '75739', 'cheryl.conner@inggroep.com'),
('William Spring 18', '84646', 'katherine.osborn@aholddelhaize.com'),
('Garcia Manor 129', '79635', 'victoria.combs@aholddelhaize.com'),
('Brian Place 77', '72103', 'jason.cantrell@philips.com'),
('Patterson Forest 166', '94943', 'monica.fisher@abnamro.com'),
('Mark Mission 82', '20937', 'glen.logan@dsm.com'),
('Contreras Alley 187', '19550', 'bryan.fritz@heineken.com'),
('Jacob Gardens 107', '13236', 'gina.ross@dsm.com'),
('Walker Ville 173', '22960', 'deborah.rodriguez@aholddelhaize.com'),
('Dan Stream 57', '64473', 'ryan.mitchell@royaldutchshell.com'),
('Heather Avenue 182', '09646', 'michael.dean@inggroep.com'),
('John Lakes 42', '59891', 'matthew.smith@dsm.com'),
('Collins Extension 81', '74715', 'tyler.smith@dsm.com'),
('Charles Unions 54', '12337', 'danielle.jacobs@heineken.com'),
('Tina Junctions 191', '71766', 'craig.reyes@kpmg.com'),
('Gavin Locks 99', '88891', 'nicholas.griffin@rabobank.com'),
('Thomas Extensions 194', '37926', 'brittany.gray@royaldutchshell.com'),
('Thomas Roads 191', '84214', 'natasha.taylor@royaldutchshell.com'),
('Beasley Springs 169', '66585', 'gina.smith@aholddelhaize.com'),
('Lowery Oval 4', '63971', 'tracy.fritz@royaldutchshell.com'),
('Burke Loaf 33', '93248', 'cameron.andersen@asml.com'),
('Moore Gateway 56', '83139', 'michael.alexander@dsm.com'),
('Nelson Ford 41', '11776', 'kevin.chapman@heineken.com'),
('Jason Islands 121', '20389', 'stephanie.decker@dsm.com'),
('Robert Well 117', '05125', 'zachary.hill@dsm.com'),
('Cameron Tunnel 141', '06238', 'john.campbell@philips.com'),
('Brooke Circle 80', '20433', 'tyler.landry@royaldutchshell.com'),
('Henry Park 132', '20667', 'carrie.ferguson@kpmg.com'),
('Connie River 7', '57628', 'nicholas.yu@aholddelhaize.com'),
('Daryl Corner 20', '08043', 'christine.knox@heineken.com'),
('Bryant Causeway 135', '71933', 'johnathan.nelson@heineken.com'),
('Peter Creek 173', '01441', 'karen.anderson@inggroep.com'),
('Angel Knolls 115', '53624', 'bethany.sloan@dsm.com'),
('Ford Passage 172', '61879', 'jonathan.cannon@dsm.com'),
('Deborah Plains 160', '37178', 'ian.garcia@abnamro.com'),
('Smith Summit 32', '45375', 'kelly.james@kpmg.com'),
('Luna Road 68', '60811', 'lisa.luna@rabobank.com'),
('Richard View 134', '52770', 'john.bennett@dsm.com'),
('Houston Road 111', '13109', 'shawn.luna@dsm.com'),
('Gerald Flats 71', '80490', 'carolyn.le@abnamro.com'),
('Kevin Cliffs 72', '20555', 'michael.williams@asml.com'),
('Bailey Drive 172', '67409', 'steven.jordan@heineken.com'),
('Randolph Isle 48', '76675', 'melissa.goodwin@dsm.com'),
('Bryant Curve 7', '60639', 'eugene.cooley@aholddelhaize.com'),
('Edwards Harbors 189', '11315', 'james.reed@aholddelhaize.com'),
('Mayer Walks 179', '25167', 'patricia.fowler@heineken.com'),
('Anna Squares 125', '96435', 'eric.larsen@aholddelhaize.com'),
('Wolfe Harbors 154', '81170', 'theresa.collins@dsm.com'),
('Alvarado Creek 114', '55576', 'ashley.baker@abnamro.com'),
('Macdonald Mall 165', '66775', 'shane.king@dsm.com'),
('Michelle Vista 13', '02021', 'barry.anderson@dsm.com'),
('Peck Cliffs 112', '13170', 'natalie.adkins@inggroep.com'),
('William Tunnel 31', '25665', 'rebecca.wright@kpmg.com'),
('Cheryl Drive 62', '12669', 'mario.collins@philips.com'),
('Williams Prairie 75', '09131', 'danielle.gallegos@rabobank.com'),
('Nichole Crossing 2', '87210', 'paul.jenkins@kpmg.com'),
('Robert Mountains 142', '66188', 'tricia.bowman@aholddelhaize.com'),
('Peterson Lake 181', '02874', 'megan.foster@philips.com'),
('Mason Course 11', '58096', 'toni.oconnor@dsm.com'),
('Nathan Roads 29', '41250', 'jennifer.manning@royaldutchshell.com'),
('Lynn Circles 1', '14703', 'james.carter@aholddelhaize.com'),
('Joshua Motorway 43', '51114', 'linda.savage@abnamro.com'),
('Paula Throughway 25', '28506', 'andrea.hunter@kpmg.com'),
('Jennings Burg 78', '80323', 'diana.davis@heineken.com'),
('Sherry Neck 191', '58351', 'wesley.scott@rabobank.com'),
('Foster Forest 118', '52736', 'abigail.evans@asml.com'),
('Julia Knolls 33', '19596', 'erin.briggs@royaldutchshell.com'),
('Harrison Cove 145', '88190', 'kenneth.barber@heineken.com'),
('Brandy Centers 186', '09193', 'kristen.rowe@dsm.com'),
('Matthew Inlet 168', '14398', 'aaron.wagner@philips.com'),
('Tammy Trail 93', '92587', 'derek.mcbride@dsm.com'),
('Williams Lodge 175', '42875', 'jessica.reed@philips.com'),
('Hansen Motorway 133', '30698', 'tracy.tucker@rabobank.com'),
('Douglas Burgs 90', '54001', 'kiara.rodgers@abnamro.com'),
('Cheryl Prairie 43', '71288', 'andrew.mckinney@aholddelhaize.com'),
('Gross Gardens 41', '06264', 'kristin.ferguson@rabobank.com'),
('Vincent Summit 88', '06241', 'barbara.smith@royaldutchshell.com'),
('Jacobs Hill 132', '18277', 'thomas.ellis@philips.com'),
('David Glens 146', '12064', 'john.ruiz@royaldutchshell.com'),
('Matthew Lodge 97', '38842', 'victoria.smith@aholddelhaize.com'),
('Jenny Rue 62', '48012', 'rachel.crane@abnamro.com'),
('Brent Ports 148', '67087', 'danielle.williams@abnamro.com'),
('Maria View 25', '91505', 'anita.griffith@kpmg.com'),
('Oneal Lakes 173', '98011', 'william.clayton@rabobank.com'),
('Hamilton Mountains 43', '20406', 'lorraine.brown@heineken.com'),
('Miller Row 138', '33172', 'heather.jackson@dsm.com'),
('Reid Fields 162', '90003', 'michael.brown@inggroep.com'),
('Robinson Knoll 39', '48028', 'katrina.chandler@asml.com'),
('Teresa Throughway 148', '03876', 'jane.shaffer@royaldutchshell.com'),
('Carlos Ports 93', '88404', 'wendy.hart@dsm.com'),
('Sanchez Light 95', '82391', 'nancy.flynn@kpmg.com'),
('Kimberly Forest 136', '49334', 'kelly.fuentes@royaldutchshell.com'),
('Fuentes Streets 39', '18768', 'melissa.miller@rabobank.com'),
('Cynthia Stream 55', '34948', 'scott.miller@aholddelhaize.com'),
('Adam Mall 151', '43820', 'robert.snow@abnamro.com'),
('Ward Shoals 27', '37368', 'paul.kim@abnamro.com'),
('Torres Hills 141', '14937', 'karen.chavez@inggroep.com'),
('Davis Terrace 74', '63405', 'alison.orr@heineken.com'),
('Megan Isle 200', '89854', 'stephen.obrien@inggroep.com'),
('Drake Mountain 23', '24801', 'ryan.coleman@abnamro.com'),
('William Oval 36', '06957', 'brett.richardson@kpmg.com'),
('Mathew Light 84', '06053', 'amber.crawford@royaldutchshell.com'),
('Lynch Creek 53', '22109', 'michael.rice@inggroep.com'),
('Cruz Cape 183', '81190', 'michelle.diaz@rabobank.com'),
('Charles Common 187', '40427', 'brandi.collins@abnamro.com'),
('David Ways 95', '18145', 'christine.aguilar@abnamro.com'),
('Wendy Islands 191', '72391', 'tyler.castaneda@philips.com'),
('Robert Cape 183', '86006', 'dustin.brown@rabobank.com'),
('Jasmine Islands 188', '04614', 'scott.chavez@rabobank.com'),
('Matthew Tunnel 135', '12217', 'pamela.hubbard@royaldutchshell.com'),
('Johnson Springs 135', '80551', 'tiffany.banks@abnamro.com'),
('Davis Village 135', '52221', 'steven.trujillo@dsm.com'),
('Sims Meadow 6', '52497', 'travis.cole@asml.com'),
('Mathews Groves 193', '56550', 'donald.clark@asml.com'),
('Cunningham Forges 172', '69631', 'allen.stewart@kpmg.com'),
('Ibarra Overpass 2', '81316', 'joseph.young@dsm.com'),
('Hayes Hill 65', '68350', 'desiree.hodges@kpmg.com'),
('Amber Square 11', '01742', 'katie.thomas@dsm.com'),
('Ramos Fort 29', '37939', 'ryan.moore@dsm.com'),
('Le Orchard 45', '72625', 'johnny.morrison@heineken.com'),
('Perkins Locks 197', '93918', 'thomas.douglas@inggroep.com'),
('Parks Estates 161', '12862', 'sheila.harrison@asml.com'),
('Chambers Pike 55', '15654', 'jennifer.keller@inggroep.com'),
('Ronald Spring 122', '96908', 'gina.calhoun@dsm.com'),
('Cabrera Brooks 162', '03434', 'perry.morgan@rabobank.com'),
('Chad Stream 185', '06109', 'mary.bentley@philips.com'),
('Nguyen Curve 84', '71311', 'steven.frey@aholddelhaize.com'),
('Joseph Ridges 180', '53386', 'jeffrey.reed@royaldutchshell.com'),
('Monica Mews 44', '58813', 'albert.thomas@rabobank.com'),
('Alejandro Square 187', '46433', 'julie.white@dsm.com'),
('Maldonado Manor 126', '81725', 'troy.walker@aholddelhaize.com'),
('Amanda Hill 154', '08809', 'lisa.brandt@inggroep.com'),
('Mccarthy Orchard 100', '37601', 'chad.edwards@dsm.com'),
('Williams Plain 133', '29675', 'jessica.williamson@heineken.com'),
('Garrett Plains 32', '86362', 'samuel.meyer@royaldutchshell.com'),
('Rangel Mills 83', '81732', 'kristina.luna@philips.com'),
('Lawrence Row 43', '73057', 'julian.myers@asml.com'),
('Martin Skyway 123', '53315', 'adrian.taylor@kpmg.com'),
('Allison Mill 69', '40109', 'jennifer.sexton@abnamro.com'),
('Thomas Port 178', '57495', 'gregory.mason@philips.com'),
('Hopkins Viaduct 184', '29992', 'michael.cook@philips.com'),
('Graham Garden 28', '98288', 'elaine.mcfarland@dsm.com'),
('Gross Rapid 21', '39132', 'valerie.guzman@dsm.com'),
('James Crest 47', '44339', 'robert.baker@rabobank.com'),
('James Lane 119', '89610', 'sarah.fisher@rabobank.com'),
('Giles Trafficway 57', '98063', 'keith.long@kpmg.com'),
('Robinson Pass 15', '49016', 'laura.clay@royaldutchshell.com'),
('Paul Squares 153', '61942', 'jeremy.mcneil@kpmg.com'),
('Webb Roads 112', '76144', 'michael.brock@dsm.com'),
('Victoria Circles 61', '60071', 'monica.cooper@aholddelhaize.com'),
('Michael Ports 47', '55557', 'alyssa.rivera@dsm.com'),
('Brown Courts 55', '95592', 'robert.price@philips.com'),
('Barrera Drives 157', '21394', 'sheila.williams@abnamro.com'),
('Elliott Curve 108', '49160', 'melissa.watson@royaldutchshell.com'),
('Jones Stravenue 186', '61737', 'jeanne.clayton@abnamro.com'),
('Green Ports 160', '22411', 'michelle.jones@rabobank.com'),
('Jason Gardens 171', '09897', 'gregory.long@abnamro.com'),
('Calvin Harbors 101', '24411', 'karen.jackson@heineken.com'),
('Samantha Run 169', '13828', 'rachel.brady@abnamro.com'),
('Rhodes Pines 86', '42485', 'christopher.brown@rabobank.com'),
('Henderson Mission 38', '52230', 'anita.park@rabobank.com'),
('James Ramp 61', '46426', 'kristen.torres@philips.com'),
('Baker Circles 78', '70827', 'sean.rios@abnamro.com'),
('Kevin Island 53', '13796', 'timothy.ramos@philips.com'),
('Jacob Wall 181', '15049', 'sarah.lee@kpmg.com'),
('Chandler Trail 119', '64702', 'julie.zamora@dsm.com'),
('Tabitha Gardens 106', '81066', 'donald.rollins@heineken.com'),
('Jessica Crossroad 105', '93283', 'mason.sosa@inggroep.com'),
('Robinson Haven 174', '24005', 'sean.sharp@inggroep.com'),
('Michelle Fall 29', '05570', 'natasha.rodriguez@dsm.com'),
('Martinez Lodge 92', '59081', 'david.blanchard@kpmg.com'),
('Jenkins Path 107', '06649', 'karen.daniel@asml.com'),
('Stephanie Port 195', '68430', 'david.pearson@aholddelhaize.com'),
('Rogers Drives 74', '75049', 'nathan.owen@abnamro.com'),
('Smith Drive 141', '49677', 'angela.higgins@asml.com'),
('John Hills 81', '44027', 'jose.jones@abnamro.com'),
('Mcdonald Shore 6', '63855', 'daniel.thomas@dsm.com'),
('Thomas Squares 121', '24777', 'craig.hansen@inggroep.com'),
('Nichole Drive 133', '04818', 'william.howard@inggroep.com'),
('Dennis Neck 188', '78916', 'steve.kim@philips.com'),
('Berry Well 61', '15316', 'timothy.bryant@abnamro.com'),
('Ashley Brook 126', '32025', 'david.willis@dsm.com'),
('Dawn Mission 128', '58788', 'vanessa.evans@rabobank.com'),
('Mark Ports 129', '78575', 'stephen.beltran@kpmg.com'),
('Johnson Forest 184', '93914', 'cassidy.hickman@rabobank.com'),
('Gibson Expressway 142', '51395', 'nicole.haney@abnamro.com'),
('Wendy Cove 92', '34383', 'daniel.mcguire@philips.com'),
('Alexis Tunnel 187', '76494', 'katie.oneill@dsm.com'),
('Christina Vista 181', '54577', 'michael.hudson@dsm.com'),
('Short Isle 83', '91919', 'connie.clark@asml.com'),
('Morton Garden 95', '89160', 'christina.stephens@kpmg.com'),
('Joshua Orchard 158', '75024', 'christina.harvey@philips.com'),
('Shannon Fields 51', '84247', 'anthony.mejia@philips.com'),
('Neal Common 145', '22516', 'joshua.gordon@rabobank.com'),
('William Landing 185', '15063', 'juan.garcia@philips.com'),
('Michael Squares 36', '76523', 'justin.sampson@inggroep.com'),
('Pierce Crossing 162', '52673', 'angela.herrera@rabobank.com'),
('Noble Junctions 129', '88941', 'eugene.mcconnell@dsm.com'),
('Madison Meadow 106', '34986', 'rachel.mitchell@philips.com'),
('Vicki Shoals 14', '06312', 'dana.patterson@dsm.com'),
('White Bypass 176', '56736', 'shane.middleton@inggroep.com'),
('Ruiz Forges 189', '54586', 'amanda.cordova@abnamro.com'),
('Torres Springs 86', '15841', 'christopher.wells@royaldutchshell.com'),
('Waters Knolls 73', '87410', 'jennifer.harrison@philips.com'),
('Michael Field 43', '57902', 'jimmy.gonzalez@rabobank.com'),
('Angela Loop 7', '10083', 'ryan.woods@rabobank.com'),
('Joseph Street 101', '60781', 'jeffrey.nielsen@royaldutchshell.com'),
('Zachary Plain 80', '43221', 'lawrence.dickerson@kpmg.com'),
('Davidson Shore 12', '47173', 'brandon.moreno@dsm.com'),
('Albert Square 30', '67982', 'alicia.cervantes@aholddelhaize.com'),
('Rose Hills 58', '29908', 'samuel.bentley@abnamro.com'),
('Willie Walks 146', '26480', 'julia.white@dsm.com'),
('Barbara Mall 194', '59588', 'christopher.lee@heineken.com'),
('Stephanie Brooks 146', '75542', 'brett.johnson@royaldutchshell.com'),
('Gomez Isle 178', '95807', 'christine.mathews@royaldutchshell.com'),
('Phillip Summit 134', '96920', 'ashley.forbes@heineken.com'),
('Wells Underpass 124', '97340', 'joshua.curry@rabobank.com'),
('Mack Rapid 37', '74804', 'sara.green@kpmg.com'),
('Miller Tunnel 47', '55018', 'ryan.blankenship@asml.com'),
('Kane Corner 153', '36653', 'timothy.henderson@philips.com'),
('Randy Crest 162', '54167', 'courtney.green@abnamro.com'),
('Cunningham Isle 63', '96593', 'laura.gilbert@philips.com'),
('Green Shore 67', '81436', 'donna.brown@rabobank.com'),
('Cameron Dale 125', '72286', 'jessica.morales@abnamro.com'),
('Mark Center 79', '31647', 'helen.delgado@asml.com'),
('Suarez Drives 29', '37674', 'justin.walls@abnamro.com'),
('Tiffany Track 136', '18564', 'christopher.burns@heineken.com'),
('Natalie Trafficway 96', '35757', 'angela.pope@aholddelhaize.com'),
('Ann Fords 39', '51744', 'adrienne.anderson@rabobank.com'),
('Singleton Cliff 153', '24186', 'sandra.weaver@royaldutchshell.com'),
('Lisa Glen 17', '69849', 'wendy.williams@asml.com'),
('Singh Summit 75', '82400', 'john.george@dsm.com'),
('Davila Passage 132', '96648', 'kaylee.hart@philips.com'),
('Patty Corner 122', '44936', 'michael.allison@asml.com'),
('Stephanie Flats 165', '28174', 'evelyn.henderson@philips.com'),
('David Ramp 20', '90092', 'amy.ward@heineken.com'),
('Lauren Shoals 51', '42163', 'gary.jones@inggroep.com'),
('Bailey Stravenue 199', '38828', 'chelsea.fuller@inggroep.com'),
('Jeff Avenue 28', '51414', 'kyle.avila@kpmg.com'),
('Lauren Roads 166', '34049', 'patricia.simmons@rabobank.com'),
('Peter Field 196', '36383', 'james.thompson@asml.com'),
('Jones Mall 22', '60657', 'danielle.hines@royaldutchshell.com'),
('Charles Club 157', '99620', 'angela.patel@aholddelhaize.com'),
('Jennifer Mountains 184', '09888', 'carol.reese@kpmg.com'),
('Victoria Path 60', '08859', 'gail.farley@heineken.com'),
('Arnold Island 133', '84745', 'benjamin.pope@philips.com'),
('Stout Throughway 176', '36627', 'margaret.stanton@rabobank.com'),
('Daniel Common 5', '67021', 'tina.lambert@rabobank.com'),
('Ronald Port 198', '56482', 'rebecca.graham@asml.com'),
('Harris Keys 17', '02732', 'sara.coleman@dsm.com'),
('Smith Plains 152', '65870', 'carla.young@philips.com'),
('Kayla Estate 135', '76615', 'michael.deleon@abnamro.com'),
('Duarte Plaza 183', '60660', 'dawn.smith@philips.com'),
('Garcia Spurs 165', '55871', 'patricia.graves@kpmg.com'),
('Jason Burg 106', '76796', 'charles.jones@philips.com'),
('Robert Lake 148', '16319', 'jaime.kelly@heineken.com'),
('Wells Brooks 100', '03529', 'todd.kim@kpmg.com'),
('Michael Road 58', '72376', 'heidi.ruiz@dsm.com'),
('Jennifer Lane 110', '63981', 'daniel.henderson@abnamro.com'),
('Ronnie Tunnel 86', '67119', 'hannah.smith@heineken.com'),
('Sean Corner 88', '09927', 'rachel.gonzalez@abnamro.com'),
('Martin Manor 34', '14622', 'robert.leonard@royaldutchshell.com'),
('Grace Islands 3', '14473', 'virginia.hernandez@rabobank.com'),
('Douglas Extension 106', '36906', 'sarah.torres@heineken.com'),
('Roberts Shoals 155', '48383', 'caitlin.keller@inggroep.com'),
('Roth Drives 89', '76975', 'anthony.valenzuela@inggroep.com'),
('Maureen Lock 74', '85233', 'allison.garrett@heineken.com'),
('Mccoy Trace 125', '29535', 'stephanie.good@philips.com'),
('Hart Road 71', '03913', 'stephen.ingram@abnamro.com'),
('Stephanie View 52', '51104', 'melissa.koch@royaldutchshell.com'),
('Lisa Extensions 163', '46226', 'tina.johnston@aholddelhaize.com'),
('Martin Mountain 58', '30321', 'jeanette.ramirez@aholddelhaize.com'),
('Brian Springs 140', '14792', 'kristin.mcneil@abnamro.com'),
('Henry Light 10', '38999', 'sarah.davis@heineken.com'),
('Richardson Knolls 54', '01820', 'mary.bowers@inggroep.com'),
('Cain Lodge 70', '25536', 'justin.brown@aholddelhaize.com'),
('Jeffrey Manor 40', '63236', 'jessica.stewart@royaldutchshell.com'),
('Davis Orchard 187', '28803', 'jose.smith@philips.com'),
('Wendy Lock 100', '29453', 'jesse.ryan@abnamro.com'),
('Omar Spring 153', '03698', 'thomas.edwards@dsm.com'),
('Amanda Valley 146', '35618', 'rebecca.andrade@dsm.com'),
('Gary Orchard 129', '94288', 'judy.zimmerman@philips.com'),
('Gonzalez Parkway 98', '10731', 'lauren.dean@dsm.com'),
('Richards Shoal 180', '96382', 'jenna.lee@rabobank.com'),
('Kirk View 11', '49517', 'linda.myers@asml.com'),
('Davidson Parkways 85', '84023', 'christopher.riley@rabobank.com'),
('Jay Dale 6', '94928', 'teresa.prince@philips.com'),
('Teresa Stream 108', '23946', 'fred.williams@aholddelhaize.com'),
('Mary Creek 182', '22230', 'amy.brooks@abnamro.com'),
('Myers Bypass 133', '19163', 'brandy.walker@heineken.com'),
('Valdez Circle 155', '08404', 'rebecca.carson@philips.com'),
('Martinez Squares 115', '56174', 'madison.williams@inggroep.com'),
('Dillon Plain 122', '07939', 'brenda.andrade@philips.com'),
('Hall Keys 151', '42715', 'erin.ellis@kpmg.com'),
('Coffey Port 116', '84896', 'stanley.villegas@inggroep.com'),
('Olivia Islands 17', '94069', 'dawn.robertson@inggroep.com'),
('Garcia Hills 61', '69397', 'manuel.nelson@aholddelhaize.com'),
('Rodriguez Prairie 163', '06445', 'lorraine.garcia@royaldutchshell.com'),
('Evans Island 48', '89726', 'courtney.houston@asml.com'),
('Tiffany Plains 167', '79222', 'robert.noble@asml.com'),
('Briggs Field 17', '22521', 'michael.patel@kpmg.com'),
('John Vista 107', '89793', 'gail.smith@royaldutchshell.com'),
('Lindsey Coves 129', '43203', 'jessica.fleming@heineken.com'),
('Thomas Rapid 193', '53986', 'ana.lee@heineken.com'),
('Kiara Burg 29', '95279', 'vicki.lawson@heineken.com'),
('Black Unions 94', '83068', 'jeffrey.diaz@philips.com'),
('Leroy Overpass 106', '26818', 'anthony.lewis@abnamro.com'),
('Anderson Gateway 120', '82453', 'meagan.leonard@dsm.com'),
('Lynch Freeway 125', '25038', 'sean.turner@philips.com'),
('Vega Skyway 192', '56475', 'frederick.cabrera@inggroep.com'),
('Erin Glens 195', '66971', 'nicholas.kelly@kpmg.com'),
('Moore Courts 149', '31104', 'ashley.smith@philips.com'),
('Charles Crest 36', '90030', 'melissa.gonzales@philips.com'),
('Valdez Forges 42', '74298', 'trevor.larsen@kpmg.com'),
('Omar Manors 116', '60876', 'austin.castillo@philips.com'),
('Walsh Pass 191', '17631', 'mark.huff@kpmg.com'),
('Erica Ranch 94', '91697', 'ashley.wright@asml.com'),
('Theresa Hills 192', '14505', 'paul.bates@dsm.com'),
('Hodge Points 64', '91853', 'peter.anderson@kpmg.com'),
('Maddox Fords 115', '74943', 'sarah.johnson@royaldutchshell.com'),
('Erin Square 59', '55439', 'ashley.pope@rabobank.com'),
('James Neck 62', '64711', 'robin.reyes@abnamro.com'),
('Kelly Springs 178', '25932', 'robert.smith@asml.com'),
('Michelle Camp 41', '83252', 'jennifer.knapp@rabobank.com'),
('Berry Station 52', '64563', 'brian.schmitt@rabobank.com'),
('Doyle Skyway 45', '55748', 'lindsey.callahan@abnamro.com'),
('Steven Camp 98', '59025', 'gregory.richards@philips.com'),
('Tina Locks 92', '79233', 'latasha.rodriguez@philips.com'),
('Edwards Gardens 90', '71278', 'brenda.hughes@inggroep.com'),
('Anthony Pike 36', '73247', 'ann.jennings@heineken.com'),
('West Landing 14', '92191', 'anna.marshall@heineken.com'),
('Jacobs Curve 151', '79579', 'michael.schmidt@aholddelhaize.com'),
('Samantha Loop 20', '55425', 'kathleen.andrews@kpmg.com'),
('David Harbors 180', '55550', 'joel.henderson@asml.com'),
('Burke Coves 140', '64672', 'brandy.gutierrez@abnamro.com'),
('Melissa Manor 55', '59186', 'penny.palmer@dsm.com'),
('Wallace Point 155', '12898', 'andrew.smith@royaldutchshell.com'),
('Olivia Forks 60', '59345', 'brandy.lang@royaldutchshell.com'),
('Jessica Ford 162', '03595', 'jessica.bell@rabobank.com'),
('Barnes Corners 45', '08843', 'laura.summers@aholddelhaize.com'),
('Davis Pike 139', '35604', 'raven.barnes@asml.com'),
('Julie Greens 136', '37943', 'julia.brown@philips.com'),
('Washington Estates 66', '55398', 'gary.lucas@rabobank.com'),
('Jessica Radial 16', '19567', 'karen.woods@aholddelhaize.com'),
('Middleton Squares 99', '49778', 'paul.nelson@aholddelhaize.com'),
('Michael Tunnel 102', '63484', 'gene.brown@dsm.com'),
('Kyle Dale 37', '21585', 'jonathan.duffy@heineken.com'),
('Jonathan Camp 152', '98010', 'amber.james@asml.com'),
('Timothy Stream 57', '45783', 'david.baker@abnamro.com'),
('Meagan Lights 149', '20590', 'patrick.fisher@inggroep.com'),
('Jason Course 34', '72769', 'cassidy.jimenez@philips.com'),
('Aaron Circle 80', '36722', 'steven.rivera@royaldutchshell.com'),
('Smith Square 87', '99470', 'melvin.jackson@dsm.com'),
('Elizabeth Throughway 145', '03110', 'sandy.baker@rabobank.com'),
('Kerr Port 190', '42883', 'stephen.roberts@dsm.com'),
('Shane Lane 132', '23482', 'cindy.hood@rabobank.com'),
('Ashley Haven 177', '56505', 'victoria.figueroa@rabobank.com'),
('Luis Shoal 9', '18132', 'amanda.miller@rabobank.com'),
('Morrison Canyon 34', '83695', 'todd.long@abnamro.com'),
('Herman Fork 47', '27700', 'joshua.figueroa@abnamro.com'),
('Hailey Divide 142', '55651', 'stephen.moore@inggroep.com'),
('Jessica Village 178', '54886', 'jeffrey.jefferson@abnamro.com'),
('Dawn Canyon 131', '50153', 'kaylee.willis@asml.com'),
('Sims Valley 15', '07384', 'hailey.lopez@asml.com'),
('Booth Port 136', '07543', 'nathan.smith@aholddelhaize.com'),
('Alejandro Neck 47', '58655', 'amanda.williams@philips.com'),
('Christopher Locks 157', '92822', 'kimberly.garrett@kpmg.com'),
('James Trail 7', '81268', 'mary.cowan@heineken.com'),
('Mitchell Trafficway 70', '20681', 'eric.tucker@inggroep.com'),
('Katie Club 111', '56544', 'barbara.yang@dsm.com'),
('Evans Pines 137', '16983', 'john.cabrera@kpmg.com'),
('Samuel Keys 174', '12774', 'frank.sullivan@heineken.com'),
('Patterson Pine 177', '08228', 'john.martin@kpmg.com'),
('Lori Avenue 59', '62798', 'matthew.ramirez@dsm.com'),
('Contreras Corners 142', '70211', 'michael.schwartz@asml.com'),
('Carolyn Parkways 164', '01669', 'richard.gutierrez@kpmg.com'),
('Bridget Walk 173', '27267', 'elizabeth.rodriguez@inggroep.com'),
('Joseph Mountains 154', '64153', 'manuel.dillon@asml.com'),
('Hanson Mills 112', '41759', 'michael.combs@aholddelhaize.com'),
('Lucas Manors 131', '03235', 'diane.andrews@aholddelhaize.com'),
('Stephen Streets 30', '46043', 'katie.davis@inggroep.com'),
('Fernandez Pine 161', '61615', 'andrea.miller@heineken.com'),
('Zachary Dam 146', '74521', 'tyler.maddox@aholddelhaize.com'),
('Hunter Path 71', '20185', 'morgan.crawford@rabobank.com'),
('Ross Circles 84', '03039', 'sarah.williams@abnamro.com'),
('Poole Bypass 116', '91357', 'ryan.ramos@philips.com'),
('Shepherd Locks 35', '06881', 'brian.tran@royaldutchshell.com'),
('Danielle Run 88', '21698', 'michelle.hall@rabobank.com'),
('Belinda Flat 198', '33932', 'kristina.thomas@abnamro.com'),
('Hernandez Square 98', '36748', 'jason.parker@dsm.com'),
('Madison Street 68', '23747', 'jennifer.white@asml.com'),
('Susan Village 184', '12668', 'cindy.kent@kpmg.com'),
('Harris River 148', '88565', 'tiffany.martinez@inggroep.com'),
('Justin Grove 3', '80280', 'lori.brown@heineken.com'),
('Mann Springs 73', '09826', 'reginald.reynolds@inggroep.com'),
('Kristin Way 55', '03198', 'david.lee@aholddelhaize.com'),
('Ricardo Road 116', '21468', 'albert.spencer@royaldutchshell.com'),
('Annette Valley 98', '91212', 'robert.ryan@royaldutchshell.com'),
('Kathleen Vista 107', '83365', 'lori.roberts@dsm.com'),
('Sanchez Square 44', '97621', 'anthony.austin@rabobank.com'),
('Rios Harbor 183', '97528', 'rebecca.hall@royaldutchshell.com'),
('Johnson Drive 142', '09785', 'paul.moore@heineken.com'),
('Bailey Row 192', '83240', 'michael.shaw@royaldutchshell.com'),
('Jake Village 125', '07338', 'elizabeth.hall@asml.com'),
('Jacob Mission 59', '76850', 'olivia.myers@kpmg.com'),
('Ramirez Route 197', '85393', 'william.campbell@royaldutchshell.com'),
('Adam Prairie 134', '17639', 'jessica.tapia@royaldutchshell.com'),
('Carmen Port 154', '39150', 'jennifer.butler@royaldutchshell.com'),
('Carol Landing 83', '75768', 'michael.keller@inggroep.com'),
('Sandra Run 113', '78881', 'ricky.mcdonald@abnamro.com'),
('Richard Pines 139', '54972', 'diane.gibson@rabobank.com'),
('Kelley Well 92', '31721', 'brandon.davis@heineken.com'),
('Dylan Cliffs 140', '54443', 'sara.cline@abnamro.com'),
('Stephen Island 142', '23629', 'kenneth.romero@aholddelhaize.com'),
('Thomas Burg 190', '76694', 'stephanie.wilson@royaldutchshell.com'),
('Smith Haven 170', '37571', 'karen.cortez@heineken.com'),
('Reyes Extension 159', '46595', 'brett.blanchard@royaldutchshell.com'),
('Ronald Loaf 59', '97255', 'omar.thomas@abnamro.com'),
('Ronald Ramp 115', '20952', 'kelsey.novak@royaldutchshell.com'),
('Tara Freeway 132', '42621', 'jesse.russell@aholddelhaize.com'),
('Mayer Landing 23', '67961', 'tyler.matthews@royaldutchshell.com'),
('David Tunnel 114', '89161', 'rebecca.russell@abnamro.com'),
('Harold Hollow 68', '92762', 'holly.hardy@aholddelhaize.com'),
('Brown Road 127', '42909', 'tracy.holt@heineken.com'),
('Jessica Ville 17', '29759', 'john.frazier@dsm.com'),
('Richard Walk 184', '45872', 'zachary.jones@royaldutchshell.com'),
('Franklin Square 151', '23756', 'alan.davis@asml.com'),
('Watkins Burgs 135', '77355', 'jimmy.terry@dsm.com'),
('Samantha Corners 45', '96797', 'kyle.collins@rabobank.com'),
('Justin Bypass 175', '47581', 'cathy.gibson@heineken.com'),
('Martin Bypass 21', '30278', 'manuel.garcia@aholddelhaize.com'),
('Jennifer Freeway 101', '37001', 'cheryl.welch@royaldutchshell.com'),
('Brandy Street 98', '44578', 'sandra.white@abnamro.com'),
('Garcia Alley 1', '47887', 'katherine.wallace@heineken.com'),
('Ashley Ferry 176', '18754', 'natalie.holt@rabobank.com'),
('Murphy Stravenue 139', '81388', 'joseph.herman@abnamro.com'),
('Nancy Wall 17', '24989', 'mary.smith@inggroep.com'),
('Christine Lakes 37', '80558', 'rita.hansen@kpmg.com'),
('Steven Ferry 160', '73740', 'james.sweeney@inggroep.com'),
('Monica Ridges 65', '14399', 'tammy.miller@heineken.com'),
('Mitchell View 42', '55934', 'daniel.paul@abnamro.com'),
('Nicole Lodge 190', '42980', 'eric.hanna@heineken.com'),
('Vega Pike 67', '08738', 'bryan.carter@inggroep.com'),
('Paul River 54', '96677', 'mark.barry@royaldutchshell.com'),
('Thompson Prairie 60', '44688', 'kaitlyn.parker@dsm.com'),
('Reed Islands 140', '99727', 'natasha.dickson@abnamro.com'),
('Bates Light 175', '54422', 'jeremy.espinoza@heineken.com'),
('Anthony Mission 83', '56535', 'patricia.carter@dsm.com'),
('John Cliff 30', '28227', 'samantha.ryan@heineken.com'),
('Drake Villages 123', '16259', 'claudia.noble@abnamro.com'),
('Kristin Center 42', '00525', 'rebecca.zuniga@rabobank.com'),
('Chad Valleys 65', '53894', 'michael.holt@heineken.com'),
('Cox Island 41', '58793', 'michelle.owens@dsm.com'),
('Jennifer Spurs 165', '77506', 'aaron.adams@aholddelhaize.com'),
('Meagan Parkways 56', '96631', 'joshua.cooper@aholddelhaize.com'),
('Paul Crest 90', '60334', 'robert.chaney@abnamro.com'),
('Patricia Trail 137', '07754', 'max.sanchez@inggroep.com'),
('Marshall Shoal 75', '15388', 'miranda.jackson@philips.com'),
('Taylor Mountain 70', '42232', 'patricia.ferguson@aholddelhaize.com'),
('Sweeney Route 146', '19610', 'daniel.french@inggroep.com'),
('Gonzalez Hills 142', '56017', 'kevin.garcia@kpmg.com'),
('Brittany Springs 171', '75374', 'hayden.jimenez@abnamro.com'),
('Roman Orchard 33', '85985', 'nicole.williams@royaldutchshell.com'),
('Campbell Avenue 31', '23183', 'renee.chapman@rabobank.com'),
('Spencer Trace 169', '25788', 'bradley.wilson@aholddelhaize.com'),
('Phillip Bridge 149', '98265', 'dominique.stokes@rabobank.com'),
('Susan Streets 29', '32558', 'kyle.hall@dsm.com'),
('Scott Islands 46', '63501', 'kerri.garcia@heineken.com'),
('Steven Plaza 1', '92219', 'lori.wilson@philips.com'),
('Cameron Villages 159', '02092', 'melinda.hubbard@abnamro.com'),
('Paul Canyon 177', '12251', 'tammy.horton@philips.com'),
('Johnson Walk 119', '79393', 'seth.harris@royaldutchshell.com'),
('Mills Bridge 76', '99179', 'michael.davis@inggroep.com'),
('Clifford Station 38', '64507', 'daniel.ryan@inggroep.com'),
('Horton Cape 95', '41964', 'julie.mathis@inggroep.com'),
('Williams Hills 168', '86130', 'cristian.peterson@rabobank.com'),
('Phelps Hills 71', '59722', 'patrick.cook@dsm.com'),
('Nathan Light 77', '45683', 'nicolas.welch@philips.com'),
('Teresa Parks 50', '15101', 'leslie.castro@kpmg.com'),
('Leslie Island 9', '39307', 'oscar.mills@kpmg.com'),
('Brittany Green 10', '17429', 'andre.clements@heineken.com'),
('Danielle Rapid 49', '97013', 'john.holden@abnamro.com'),
('Bernard Parkway 41', '17187', 'kathryn.taylor@royaldutchshell.com'),
('Tracy Villages 187', '25028', 'james.williams@rabobank.com'),
('Jason Mission 72', '99236', 'sabrina.vasquez@heineken.com'),
('Joseph Union 118', '75236', 'evelyn.berry@kpmg.com'),
('Jennifer Locks 175', '91632', 'jennifer.garcia@abnamro.com'),
('Alexis Square 16', '14201', 'richard.reynolds@inggroep.com'),
('Jonathan Flat 200', '63354', 'david.ingram@asml.com'),
('Jennings Spurs 185', '83926', 'matthew.malone@royaldutchshell.com'),
('Cook Plaza 137', '89794', 'randy.mays@inggroep.com'),
('Jackie Fall 36', '48661', 'melissa.miller@philips.com'),
('Jennifer Islands 97', '34536', 'charles.newman@kpmg.com'),
('Vickie Camp 153', '63582', 'jamie.lopez@inggroep.com'),
('Webster Lane 72', '52784', 'gary.martinez@kpmg.com'),
('Sean Knoll 193', '56687', 'bryan.brown@heineken.com'),
('Sanchez Pines 183', '77202', 'dawn.wilson@asml.com'),
('Jason Run 136', '66600', 'brian.quinn@inggroep.com'),
('Brown Stream 155', '62220', 'christina.griffith@aholddelhaize.com'),
('Joshua Key 81', '18469', 'pamela.adams@rabobank.com'),
('Christine Road 25', '40439', 'darren.ingram@heineken.com'),
('Andrea Spur 167', '26626', 'lori.french@kpmg.com'),
('John Spurs 14', '18102', 'sarah.hernandez@abnamro.com'),
('Carla Mall 64', '27346', 'juan.higgins@kpmg.com'),
('Patel Summit 131', '62018', 'nancy.adams@philips.com'),
('Hanna Station 65', '70822', 'todd.lopez@rabobank.com'),
('Rodriguez Shoal 128', '29252', 'james.frank@kpmg.com'),
('Wright Drives 39', '33568', 'rachel.mayer@royaldutchshell.com'),
('Cummings Neck 1', '94956', 'stephen.kent@rabobank.com'),
('Andrew Villages 156', '07744', 'george.miller@inggroep.com'),
('Cheyenne Inlet 113', '84323', 'gwendolyn.rogers@dsm.com'),
('Deanna Track 136', '29728', 'douglas.richards@aholddelhaize.com'),
('Taylor Inlet 147', '94445', 'cindy.hopkins@abnamro.com'),
('Adrienne Haven 144', '63540', 'alex.adams@asml.com'),
('Rose Rue 160', '72453', 'angela.morgan@aholddelhaize.com'),
('Gutierrez Trail 43', '55113', 'robert.fisher@kpmg.com'),
('Hull Fort 132', '58272', 'teresa.farrell@philips.com'),
('Martinez Mews 195', '77251', 'olivia.cross@philips.com'),
('Jerry Plaza 50', '37273', 'jesus.nolan@royaldutchshell.com'),
('Johns Inlet 47', '66495', 'angelica.lopez@aholddelhaize.com'),
('Robinson Locks 188', '45260', 'jessica.moore@aholddelhaize.com'),
('William Rapids 93', '26613', 'william.lee@asml.com'),
('Anne Fields 154', '32698', 'andrew.russell@abnamro.com'),
('Helen Run 123', '03553', 'joseph.gonzales@dsm.com'),
('Hernandez Squares 127', '93569', 'chad.boyle@inggroep.com'),
('Vega Ridges 187', '26259', 'tammy.howard@asml.com');

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

-- (Removed broken OrderReadModel seed: that table is never created and is not used
--  by the read side. The read model IS the Orders table in OrderServiceReadDB.)

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

-- Seed EventLogs table

INSERT INTO EventLogs (type, name, description, date, data)
VALUES (
    'Create',
    'Create order at 2026-07-03 17:48:15',
    'Create a new order with order id 1 at 2026-07-03 17:48:15',
    '2026-07-03 17:48:15',
    JSON_OBJECT(
        'orderId', 1,
        'orderStatus', 'Picking products',
        'customerId', 1
    )
);

INSERT INTO EventLogs (type, name, description, date, data)
VALUES (
    'Create',
    'Create order at 2026-07-03 14:22:02',
    'Create a new order with order id 2 at 2026-07-03 14:22:02',
    '2026-07-03 14:22:02',
    JSON_OBJECT(
        'orderId', 2,
        'orderStatus', 'Picking products',
        'customerId', 2
    )
);

-- =====================================================================
-- Principle of least privilege
-- The application services must NOT connect as root. Each service gets its
-- own database user with ONLY DML rights (SELECT/INSERT/UPDATE/DELETE) on
-- its OWN database -- no DDL (CREATE/ALTER/DROP), and no access to other
-- services' data. The schema itself is owned by this init script (run once
-- as root during database initialization), not by the application users.
-- =====================================================================
CREATE USER IF NOT EXISTS 'order_app'@'%'     IDENTIFIED BY 'order_app_pw';
CREATE USER IF NOT EXISTS 'orderread_app'@'%' IDENTIFIED BY 'orderread_app_pw';
CREATE USER IF NOT EXISTS 'warehouse_app'@'%' IDENTIFIED BY 'warehouse_app_pw';
CREATE USER IF NOT EXISTS 'customer_app'@'%'  IDENTIFIED BY 'customer_app_pw';
CREATE USER IF NOT EXISTS 'shipping_app'@'%'  IDENTIFIED BY 'shipping_app_pw';
CREATE USER IF NOT EXISTS 'payment_app'@'%'   IDENTIFIED BY 'payment_app_pw';
CREATE USER IF NOT EXISTS 'catalog_app'@'%'  IDENTIFIED BY 'catalog_app_pw';

GRANT SELECT, INSERT, UPDATE, DELETE ON OrderServiceDB.*     TO 'order_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON OrderServiceReadDB.* TO 'orderread_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON WarehouseServiceDB.* TO 'warehouse_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON CustomerServiceDB.*  TO 'customer_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON ShippingServiceDB.*  TO 'shipping_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON PaymentServiceDB.*   TO 'payment_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON CatalogServiceDB.*   TO 'catalog_app'@'%';

FLUSH PRIVILEGES;