const fs = require("fs");
const XLSX = require("xlsx");

module.exports = {
    // Read csv file
    async readCustomerCsv() {
        try {
            // Get the file from the docker volume
            const filePath = "/app/customer_data.csv";

            // Read file as UTF-8 text
            const csv = fs.readFileSync(filePath, "utf8");

            // Parse CSV manually
            const workbook = XLSX.read(csv, { type: "string" });

            // Get the disired sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const data = XLSX.utils.sheet_to_json(sheet);

            // Map CSV column names to schema
            return data.map((row) => ({
                companyName: row["Company Name"] || null,
                firstName: row["First Name"] || null,
                lastName: row["Last Name"] || null,
                phoneNumber: row["Phone Number"] || null,
                address: row["Address"] || null
            }));
        } catch (err) {
            console.error("Error reading customer data:", err);
            throw err;
        }
    }
};
