const fs = require("fs");
const XLSX = require("xlsx");

module.exports = {
    // Read an excel file
    async readExcelFile() {
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

            return data
        } catch (err) {
            console.error("Error reading customer data:", err);
            throw err;
        }
    }
};
