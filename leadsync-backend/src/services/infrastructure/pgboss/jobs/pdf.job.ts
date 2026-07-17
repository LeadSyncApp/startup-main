export interface PdfJobPayload {
  templateId: string;
  data: Record<string, unknown>;
  destinationPath: string;
}

export const PDF_JOB_NAME = 'GENERATE_PDF';
