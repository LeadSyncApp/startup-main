"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileParserService = exports.FileParserService = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const mammoth_1 = __importDefault(require("mammoth"));
const exceljs_1 = __importDefault(require("exceljs"));
const pdf = require("pdf-parse");
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
class FileParserService {
    /**
     * Extracts text content from various file formats.
     */
    async extractText(file) {
        const mimetype = file.mimetype;
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        try {
            if (mimetype === 'application/pdf' || extension === 'pdf') {
                const data = await pdf(file.buffer);
                return data.text;
            }
            if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
                const result = await mammoth_1.default.extractRawText({ buffer: Buffer.from(file.buffer) });
                return result.value;
            }
            if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || extension === 'xlsx') {
                const workbook = new exceljs_1.default.Workbook();
                await workbook.xlsx.load(Buffer.from(file.buffer));
                let content = "";
                workbook.eachSheet((sheet) => {
                    content += `Sheet: ${sheet.name}\n`;
                    sheet.eachRow((row) => {
                        const rowData = Array.isArray(row.values)
                            ? row.values.filter(Boolean).join(" | ")
                            : "";
                        content += rowData + "\n";
                    });
                });
                return content;
            }
            if (mimetype === 'text/csv' || extension === 'csv') {
                return file.buffer.toString('utf-8');
            }
            if (mimetype.startsWith('text/') || extension === 'txt') {
                return file.buffer.toString('utf-8');
            }
            throw new Error(`Unsupported file type: ${mimetype}`);
        }
        catch (error) {
            console.error("File extraction error:", error);
            throw new Error(`Failed to extract text from file: ${error.message}`);
        }
    }
}
exports.FileParserService = FileParserService;
exports.fileParserService = new FileParserService();
