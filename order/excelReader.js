import * as XLSX from "xlsx";

module.exports = {
    // Read an excel file
    async readExcelFile(sheetNr) {
        try {
            // Get the file from the docker volume
            const filePath = "/app/customer_data.csv";

            // Read workbook
            const workbook = XLSX.readFile(filePath);

            // Get the disired sheet
            const sheetName = workbook.SheetNames[sheetNr];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const data = XLSX.utils.sheet_to_json(sheet);

            return data;
        } catch (err) {
            console.error("Error reading customer data:", err);
            throw err;
        }
    }
};
