import { createWorker } from "tesseract.js";

export type OcrResult = {
  text: string;
  confidence: number;
};

export async function extractTextFromImageBuffer(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(imageBuffer);
    return {
      text: result.data.text ?? "",
      confidence: result.data.confidence ?? 0
    };
  } finally {
    await worker.terminate();
  }
}
