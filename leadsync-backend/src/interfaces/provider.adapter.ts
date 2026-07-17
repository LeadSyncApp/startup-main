import { StandardMessageFrame } from "./messaging.interface";

export interface ProviderAdapter {
  normalizePayload(body: any): StandardMessageFrame | null;
}
