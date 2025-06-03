const crypto = require('crypto');

class CryptoUtils {
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    generateSalt(length = 16) {
        return crypto.randomBytes(length).toString('hex');
    }

    hash(data, salt) {
        const hash = crypto.createHmac('sha256', salt);
        hash.update(data);
        return hash.digest('hex');
    }

    hashWithSalt(data) {
        const salt = this.generateSalt();
        const hashed = this.hash(data, salt);
        return { hash: hashed, salt };
    }

    verifyHash(data, hash, salt) {
        const computed = this.hash(data, salt);
        return computed === hash;
    }

    encrypt(text, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decrypt(text, key) {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

module.exports = new CryptoUtils();
