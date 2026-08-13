import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$server/db/client';
import { linkedAccounts } from '$server/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '$server/auth-guard';
import { encryptFields } from '$server/crypto';

/**
 * Admin-only: every linked Kite/Kotak follower account, without secrets.
 * (Never return the Kite or Kotak credential columns to the client — this is
 * the one place that decides what's safe to expose from `linkedAccounts`.)
 */
export const listLinkedAccounts = query(() => {
	requireAdmin();
	return db
		.select({
			id: linkedAccounts.id,
			broker: linkedAccounts.broker,
			label: linkedAccounts.label,
			multiplier: linkedAccounts.multiplier,
			enabled: linkedAccounts.enabled,
			createdAt: linkedAccounts.createdAt
		})
		.from(linkedAccounts);
});

const ToggleAccountInput = v.object({
	id: v.string(),
	enabled: v.boolean()
});

export const setAccountEnabled = command(ToggleAccountInput, async ({ id, enabled }) => {
	requireAdmin();
	await db.update(linkedAccounts).set({ enabled }).where(eq(linkedAccounts.id, id));
	await listLinkedAccounts().refresh();
});

const UpdateMultiplierInput = v.object({
	id: v.string(),
	multiplier: v.pipe(v.number(), v.minValue(0.01), v.maxValue(10))
});

export const setAccountMultiplier = command(UpdateMultiplierInput, async ({ id, multiplier }) => {
	requireAdmin();
	await db.update(linkedAccounts).set({ multiplier }).where(eq(linkedAccounts.id, id));
	await listLinkedAccounts().refresh();
});

const AddKiteAccountInput = v.object({
	id: v.pipe(v.string(), v.minLength(1), v.regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only')),
	label: v.pipe(v.string(), v.minLength(1)),
	multiplier: v.pipe(v.number(), v.minValue(0.01), v.maxValue(10)),
	kiteApiKey: v.pipe(v.string(), v.minLength(1)),
	kiteApiSecret: v.pipe(v.string(), v.minLength(1)),
	kiteUserId: v.pipe(v.string(), v.minLength(1)),
	kitePassword: v.pipe(v.string(), v.minLength(1)),
	kiteTotpSecret: v.pipe(v.string(), v.minLength(1))
});

export const addKiteAccount = command(AddKiteAccountInput, async (input) => {
	requireAdmin();

	const existing = await db.select({ id: linkedAccounts.id }).from(linkedAccounts).where(eq(linkedAccounts.id, input.id));
	if (existing.length > 0) {
		throw new Error(`An account with id "${input.id}" already exists`);
	}

	const encrypted = encryptFields({
		kiteApiKey: input.kiteApiKey,
		kiteApiSecret: input.kiteApiSecret,
		kiteUserId: input.kiteUserId,
		kitePassword: input.kitePassword,
		kiteTotpSecret: input.kiteTotpSecret
	});

	await db.insert(linkedAccounts).values({
		id: input.id,
		broker: 'kite',
		label: input.label,
		multiplier: input.multiplier,
		enabled: true,
		...encrypted,
		createdAt: new Date().toISOString()
	});

	await listLinkedAccounts().refresh();
});

const AddKotakAccountInput = v.object({
	id: v.pipe(v.string(), v.minLength(1), v.regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only')),
	label: v.pipe(v.string(), v.minLength(1)),
	multiplier: v.pipe(v.number(), v.minValue(0.01), v.maxValue(10)),
	kotakConsumerKey: v.pipe(v.string(), v.minLength(1)),
	kotakConsumerSecret: v.pipe(v.string(), v.minLength(1)),
	kotakMobileNumber: v.pipe(v.string(), v.minLength(10)),
	kotakPassword: v.pipe(v.string(), v.minLength(1)),
	kotakTotpSecret: v.pipe(v.string(), v.minLength(1)),
	kotakMpin: v.pipe(v.string(), v.minLength(4))
});

export const addKotakAccount = command(AddKotakAccountInput, async (input) => {
	requireAdmin();

	const existing = await db.select({ id: linkedAccounts.id }).from(linkedAccounts).where(eq(linkedAccounts.id, input.id));
	if (existing.length > 0) {
		throw new Error(`An account with id "${input.id}" already exists`);
	}

	const encrypted = encryptFields({
		kotakConsumerKey: input.kotakConsumerKey,
		kotakConsumerSecret: input.kotakConsumerSecret,
		kotakMobileNumber: input.kotakMobileNumber,
		kotakPassword: input.kotakPassword,
		kotakTotpSecret: input.kotakTotpSecret,
		kotakMpin: input.kotakMpin
	});

	await db.insert(linkedAccounts).values({
		id: input.id,
		broker: 'kotak_neo',
		label: input.label,
		multiplier: input.multiplier,
		enabled: true,
		...encrypted,
		createdAt: new Date().toISOString()
	});

	await listLinkedAccounts().refresh();
});

const RemoveAccountInput = v.object({ id: v.string() });

export const removeLinkedAccount = command(RemoveAccountInput, async ({ id }) => {
	requireAdmin();
	await db.delete(linkedAccounts).where(eq(linkedAccounts.id, id));
	await listLinkedAccounts().refresh();
});
