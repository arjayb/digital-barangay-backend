const crypto = require('crypto');

const VERSION = 'v1';
function key() {
  const secret = process.env.CLAIM_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('CLAIM_TOKEN_SECRET or JWT_SECRET is required');
  return crypto.createHash('sha256').update(secret).digest();
}

function encodeClaimToken(requestId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(requestId), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), encrypted.toString('base64url'), tag.toString('base64url')].join('.');
}

function decodeClaimToken(token) {
  try {
    const [version, ivPart, encryptedPart, tagPart] = String(token || '').split('.');
    if (version !== VERSION || !ivPart || !encryptedPart || !tagPart) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const clear = Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]);
    return clear.toString('utf8');
  } catch {
    return null;
  }
}

function attachClaimToken(request) {
  return request ? { ...request, claimToken: encodeClaimToken(request.id) } : request;
}

module.exports = { encodeClaimToken, decodeClaimToken, attachClaimToken };
