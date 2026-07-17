import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Must be a 32-byte key
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        throw new Error('ENCRYPTION_KEY must be defined and at least 32 characters long');
    }
    // Ensure key is exactly 32 bytes using SHA-256 hashing
    return crypto.createHash('sha256').update(key).digest();
};

export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = getEncryptionKey();
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Result: salt:iv:tag:encrypted
    return 'enc:' + Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
};

export const decrypt = (encryptedText: string): string => {
    if (!encryptedText.startsWith('enc:')) {
        return encryptedText; // Already plaintext, or invalid
    }
    const buffer = Buffer.from(encryptedText.substring(4), 'base64');
    
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
};

export const isEncrypted = (text: string | null | undefined): boolean => {
    return !!text && text.startsWith('enc:');
};

export const decryptSecret = (secret: string | null | undefined): string | null => {
    if (!secret) return null;
    return isEncrypted(secret) ? decrypt(secret) : secret;
};
