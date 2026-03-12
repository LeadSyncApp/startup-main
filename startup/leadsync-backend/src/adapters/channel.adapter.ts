export interface ChannelAdapter {
    verifyWebhook(req: any): Promise<boolean>;
    processWebhook(req: any, companyId: string): Promise<void>;
    sendMessage(to: string, text: string, options?: any): Promise<void>;
    sendTyping(to: string): Promise<void>;
}
