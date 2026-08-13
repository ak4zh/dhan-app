import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { env as privateEnv } from '$env/dynamic/private';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
	const secret = privateEnv.ENCRYPTION_KEY;
	if (!secret) {
		throw new Error(
			'ENCRYPTION_KEY env var is not set — generate one with `openssl rand -hex 32` and add it to .env before storing broker credentials.'
		);
	}
	// Accept either a 32-byte hex string directly, or derive one via scrypt so any
	// passphrase-shaped value also works.
	if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, 'hex');
	return scryptSync(secret, 'dhan-app-broker-secrets', 32);
}

/** Encrypts a plaintext broker secret for storage. Returns "iv:authTag:ciphertext", all hex. */
export function encryptSecret(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Reverses encryptSecret. Throws if the value is malformed or the key doesn't match. */
export function decryptSecret(stored: string): string {
	const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
	if (!ivHex || !authTagHex || !ciphertextHex) {
		throw new Error('Stored secret is not in the expected iv:authTag:ciphertext format');
	}
	const key = getKey();
	const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
	const plaintext = Buffer.concat([
		decipher.update(Buffer.from(ciphertextHex, 'hex')),
		decipher.final()
	]);
	return plaintext.toString('utf8');
}

/** Encrypts every defined value in an object — used when writing broker credential fields. */
export function encryptFields<T extends Record<string, string | undefined>>(fields: T): T {
	const out = { ...fields };
	for (const key of Object.keys(out) as (keyof T)[]) {
		const val = out[key];
		if (typeof val === 'string' && val.length > 0) {
			out[key] = encryptSecret(val) as T[keyof T];
		}
	}
	return out;
}
