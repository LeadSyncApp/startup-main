import multer from "multer";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
// Use pdf2json (server-friendly) instead of pdf-parse (which pulls browser APIs in some versions)
const PDFParser = require("pdf2json");

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
                // pdf2json works with buffers via parseBuffer and emits events when ready.
                const extracted = await new Promise<string>((resolve, reject) => {
                    try {
                        const pdfParser = new PDFParser();
                        pdfParser.on("pdfParser_dataError", (err: any) => {
                            reject(err?.parserError || err);
                        });
                        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                            try {
                                let text = "";
                                const pages = pdfData?.formImage?.Pages || [];
                                pages.forEach((page: any) => {
                                    (page.Texts || []).forEach((t: any) => {
                                        (t.R || []).forEach((r: any) => {
                                            if (r.T) {
                                                // pdf2json encodes text as URI components
                                                text += decodeURIComponent(r.T) + " ";
                                            }
                                        });
                                    });
                                    text += "\n";
                                });
                                resolve(text.trim());
                            } catch (e) {
                                reject(e);
                            }
                        });
                        pdfParser.parseBuffer(Buffer.from(file.buffer));
                    } catch (err) {
                        reject(err);
                    }
                });

                return extracted;
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
