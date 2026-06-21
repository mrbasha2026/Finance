import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:";

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

export function encryptKey(plain: string): string {
  const key = getKey();
  if (!key) return plain;

  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptKey(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  if (!key) return stored;

  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return stored;
  const [ivHex, tagHex, encHex] = parts;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return stored;
  }
}
