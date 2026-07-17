import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard GCM IV length
const TAG_LENGTH = 16; // Standard GCM auth tag length

export class CryptoService {
    /**
     * Resolves the environment key and ensures it is securely hashed to exactly 32 bytes
     */
    private static getEncryptionKey(): Buffer {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error("ENCRYPTION_KEY environment variable is not defined");
        }
        // Always hash the key to guarantee a 256-bit key buffer regardless of passphrase length
        return crypto.createHash("sha256").update(key).digest();
    }

    /**
     * Encrypts a plaintext token string into an AES-256-GCM safe payload.
     * Output format: sha256_iv:auth_tag:ciphertext in hex or base64.
     */
    public static encryptToken(token: string): string {
        try {
            if (!token) return "";
            const key = this.getEncryptionKey();
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            
            let encrypted = cipher.update(token, "utf8", "hex");
            encrypted += cipher.final("hex");
            
            const authTag = cipher.getAuthTag().toString("hex");
            
            // Format: iv:authTag:ciphertext
            return `${iv.toString("hex")}:${authTag}:${encrypted}`;
        } catch (error: any) {
            console.error("❌ [CryptoService] Encryption failed:", error.message || error);
            throw new Error(`Encryption failure: ${error.message}`);
        }
    }

    /**
     * Decrypts an AES-256-GCM payload format of mapped token string back to plaintext.
     */
    public static decryptToken(encryptedData: string): string {
        try {
            if (!encryptedData) return "";

            // Check if string is formatted in our standard iv:tag:ciphertext layout
            const parts = encryptedData.split(":");
            if (parts.length !== 3) {
                // If it is already plaintext or invalid layout, fail gracefully or return as-is
                console.warn("⚠️ [CryptoService] Token data lacks iv:tag:ciphertext structure. Returning plain text.");
                return encryptedData;
            }

            const [ivHex, tagHex, encryptedHex] = parts;
            const key = this.getEncryptionKey();
            
            const iv = Buffer.from(ivHex, "hex");
            const tag = Buffer.from(tagHex, "hex");
            const encryptedBytes = Buffer.from(encryptedHex, "hex");

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);

            let decrypted = decipher.update(encryptedBytes, undefined, "utf8");
            decrypted += decipher.final("utf8");

            return decrypted;
        } catch (error: any) {
            console.error("❌ [CryptoService] Decryption failed. Possible key mismatch or integrity compromise:", error.message || error);
            throw new Error(`Decryption failure: ${error.message}`);
        }
    }

    /**
     * Utility schema checking if a string represents an encrypted payload
     */
    public static isEncrypted(value: string | null | undefined): boolean {
        if (!value) return false;
        return value.split(":").length === 3;
    }
}
