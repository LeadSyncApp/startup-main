import multer from "multer";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
const pdf = require("pdf-parse");

const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export class FileParserService {
    /**
     * Extracts text content from various file formats.
     */
    async extractText(file: Express.Multer.File): Promise<string> {
        const mimetype = file.mimetype;
        const extension = file.originalname.split('.').pop()?.toLowerCase();

        try {
            if (mimetype === 'application/pdf' || extension === 'pdf') {
                const data = await pdf(file.buffer);
                return data.text;
            }

            if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
                const result = await mammoth.extractRawText({ buffer: Buffer.from(file.buffer) });
                return result.value;
            }

            if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || extension === 'xlsx') {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(Buffer.from(file.buffer) as any);
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
        } catch (error: any) {
            console.error("File extraction error:", error);
            throw new Error(`Failed to extract text from file: ${error.message}`);
        }
    }
}

export const fileParserService = new FileParserService();
