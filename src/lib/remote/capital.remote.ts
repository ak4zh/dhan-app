import { query, command } from '$app/server';
import * as v from 'valibot';
import { desc, eq } from 'drizzle-orm';
import { db } from '$server/db/client';
import { ledgerEntries } from '$server/db/schema';
import { requireAdmin } from '$server/auth-guard';
import { syncLedgerFromDhan, getManagerPerformance } from '$server/services/capital';

export const listLedgerEntries = query(() => {
	requireAdmin();
	return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.voucherDate));
});

const SyncLedgerInput = v.object({
	fromDate: v.pipe(v.string(), v.isoDate()),
	toDate: v.pipe(v.string(), v.isoDate())
});

export const syncLedger = command(SyncLedgerInput, async ({ fromDate, toDate }) => {
	requireAdmin();
	const result = await syncLedgerFromDhan(fromDate, toDate);
	await listLedgerEntries().refresh();
	return result;
});

const UpdateClassificationInput = v.object({
	voucherNumber: v.string(),
	cashFlowType: v.picklist(['deposit', 'withdrawal', 'other']),
	includeInCapitalFlow: v.boolean()
});

export const updateLedgerEntryClassification = command(
	UpdateClassificationInput,
	async ({ voucherNumber, cashFlowType, includeInCapitalFlow }) => {
		requireAdmin();
		await db
			.update(ledgerEntries)
			.set({ cashFlowType, includeInCapitalFlow })
			.where(eq(ledgerEntries.voucherNumber, voucherNumber));
		await listLedgerEntries().refresh();
	}
);

const PerformanceInput = v.optional(
	v.object({
		feePercent: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
		savingsRate: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100)))
	})
);

export const managerPerformance = query(PerformanceInput, (input) => {
	requireAdmin();
	return getManagerPerformance(input?.feePercent ?? 15, input?.savingsRate ?? 7);
});
