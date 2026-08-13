import * as v from 'valibot';

let privateEnv: Record<string, string | undefined> = {};
try {
	// @ts-ignore
	const dynamicPrivate = await import('$env/dynamic/private');
	privateEnv = dynamicPrivate.env ?? {};
} catch {
	// Fallback when running outside SvelteKit context
}

const EnvSchema = v.object({
	DHAN_CLIENT_ID: v.pipe(v.string(), v.minLength(1, 'DHAN_CLIENT_ID is required')),
	// Preferred: auto-refreshes a fresh 24h token daily via Dhan's official PIN+TOTP login.
	DHAN_PIN: v.optional(v.string()),
	DHAN_TOTP_SECRET: v.optional(v.string()),
	// Fallback: a token pasted manually from Dhan Web, used until auto-refresh has run once.
	DHAN_ACCESS_TOKEN: v.optional(v.string())
});

const parsed = v.safeParse(EnvSchema, {
	DHAN_CLIENT_ID: privateEnv.DHAN_CLIENT_ID ?? process.env.DHAN_CLIENT_ID,
	DHAN_PIN: privateEnv.DHAN_PIN ?? process.env.DHAN_PIN,
	DHAN_TOTP_SECRET: privateEnv.DHAN_TOTP_SECRET ?? process.env.DHAN_TOTP_SECRET,
	DHAN_ACCESS_TOKEN: privateEnv.DHAN_ACCESS_TOKEN ?? process.env.DHAN_ACCESS_TOKEN
});

if (!parsed.success) {
	const issues = parsed.issues.map((i) => `${i.path?.map((p) => p.key).join('.')}: ${i.message}`);
	console.error('⚠️  Missing/invalid Dhan env vars:\n' + issues.join('\n'));
}

export const dhanEnv = parsed.success
	? parsed.output
	: {
			DHAN_CLIENT_ID: privateEnv.DHAN_CLIENT_ID ?? process.env.DHAN_CLIENT_ID ?? '',
			DHAN_PIN: privateEnv.DHAN_PIN ?? process.env.DHAN_PIN,
			DHAN_TOTP_SECRET: privateEnv.DHAN_TOTP_SECRET ?? process.env.DHAN_TOTP_SECRET,
			DHAN_ACCESS_TOKEN: privateEnv.DHAN_ACCESS_TOKEN ?? process.env.DHAN_ACCESS_TOKEN
		};
