<script lang="ts">
	import {
		listLedgerEntries,
		syncLedger,
		updateLedgerEntryClassification,
		managerPerformance
	} from '$lib/remote/capital.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';

	const entries = listLedgerEntries();

	let feePercent = $state(15);
	let savingsRate = $state(7);
	let perf = $state(managerPerformance({ feePercent, savingsRate }));

	function refreshPerf() {
		perf = managerPerformance({ feePercent, savingsRate });
	}

	// today, and 3 years back, as sensible sync defaults
	const today = new Date().toISOString().slice(0, 10);
	const threeYearsAgo = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().slice(0, 10);
	let syncFrom = $state(threeYearsAgo);
	let syncTo = $state(today);
	let syncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncResult = $state<{ synced: number; skipped: number } | null>(null);

	async function handleSync() {
		syncing = true;
		syncError = null;
		syncResult = null;
		try {
			syncResult = await syncLedger({ fromDate: syncFrom, toDate: syncTo });
			refreshPerf();
		} catch (err) {
			syncError = err instanceof Error ? err.message : 'Sync failed';
		} finally {
			syncing = false;
		}
	}

	async function updateEntry(voucherNumber: string, cashFlowType: 'deposit' | 'withdrawal' | 'other', includeInCapitalFlow: boolean) {
		await updateLedgerEntryClassification({ voucherNumber, cashFlowType, includeInCapitalFlow });
		refreshPerf();
	}

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
	}
</script>

<div class="space-y-6">
	<h1 class="text-xl font-semibold">Manager performance</h1>
	<p class="text-sm text-muted-foreground">
		Compares your actual portfolio (net of an estimated performance fee) against what the same
		deposits/withdrawals would be worth in a savings account instead.
	</p>

	<Card>
		<CardHeader>
			<CardTitle>Sync ledger from Dhan</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex items-end gap-4">
				<div class="space-y-1">
					<Label for="syncFrom">From</Label>
					<Input id="syncFrom" type="date" bind:value={syncFrom} />
				</div>
				<div class="space-y-1">
					<Label for="syncTo">To</Label>
					<Input id="syncTo" type="date" bind:value={syncTo} />
				</div>
				<Button onclick={handleSync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync'}</Button>
			</div>
			{#if syncError}
				<p class="mt-2 text-sm text-destructive">{syncError}</p>
			{/if}
			{#if syncResult}
				<p class="mt-2 text-sm text-muted-foreground">
					Synced {syncResult.synced} entries{syncResult.skipped > 0 ? ` (${syncResult.skipped} skipped — unparseable date)` : ''}.
				</p>
			{/if}
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Assumptions</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex items-end gap-4">
				<div class="space-y-1">
					<Label for="feePercent">Manager fee (%, above high-water mark)</Label>
					<Input id="feePercent" type="number" step="0.5" bind:value={feePercent} onchange={refreshPerf} />
				</div>
				<div class="space-y-1">
					<Label for="savingsRate">Savings account rate (% p.a.)</Label>
					<Input id="savingsRate" type="number" step="0.5" bind:value={savingsRate} onchange={refreshPerf} />
				</div>
			</div>
		</CardContent>
	</Card>

	{#await perf}
		<p class="text-sm text-muted-foreground">Calculating…</p>
	{:then p}
		{#if p.warnings.length > 0}
			<div class="space-y-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
				{#each p.warnings as w}
					<p>⚠️ {w}</p>
				{/each}
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-xs text-muted-foreground">Deposited / Withdrawn</p>
				<p class="text-lg font-semibold">₹{fmt(p.totalDeposited)} / ₹{fmt(p.totalWithdrawn)}</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-xs text-muted-foreground">Cumulative realized profit</p>
				<p class="text-lg font-semibold">₹{fmt(p.cumulativeRealizedProfit)}</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-xs text-muted-foreground">Estimated fee owed ({p.feePercent}% above HWM)</p>
				<p class="text-lg font-semibold">₹{fmt(p.estimatedFeeOwed)}</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-xs text-muted-foreground">Your value (net of estimated fee)</p>
				<p class="text-lg font-semibold">₹{fmt(p.yourValueAfterEstimatedFee)}</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-xs text-muted-foreground">Savings account benchmark ({p.savingsAccountRate}%)</p>
				<p class="text-lg font-semibold">₹{fmt(p.savingsAccountBenchmarkValue)}</p>
			</div>
			<div class="rounded-lg border p-4" class:border-primary={p.benefit >= 0} class:border-destructive={p.benefit < 0} class:bg-card={true}>
				<p class="text-xs text-muted-foreground">Benefit vs. savings account</p>
				<p class="text-lg font-semibold" class:text-primary={p.benefit >= 0} class:text-destructive={p.benefit < 0}>
					{p.benefit >= 0 ? '+' : ''}₹{fmt(p.benefit)}
				</p>
			</div>
		</div>
	{:catch error}
		<p class="text-sm text-destructive">{error?.body?.message ?? error?.message ?? 'Failed to calculate'}</p>
	{/await}

	<Card>
		<CardHeader>
			<CardTitle>Ledger entries — review classification</CardTitle>
		</CardHeader>
		<CardContent class="p-0">
			{#await entries}
				<p class="p-4 text-sm text-muted-foreground">Loading…</p>
			{:then rows}
				{#if rows.length === 0}
					<p class="p-4 text-sm text-muted-foreground">No ledger entries synced yet.</p>
				{:else}
					<table class="w-full text-sm">
						<thead class="border-b border-border bg-muted/50 text-left text-muted-foreground">
							<tr>
								<th class="px-4 py-2 font-medium">Date</th>
								<th class="px-4 py-2 font-medium">Narration</th>
								<th class="px-4 py-2 font-medium">Debit</th>
								<th class="px-4 py-2 font-medium">Credit</th>
								<th class="px-4 py-2 font-medium">Type</th>
								<th class="px-4 py-2 font-medium">Counts</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each rows as row (row.voucherNumber)}
								<tr>
									<td class="px-4 py-2 whitespace-nowrap">{row.voucherDate}</td>
									<td class="px-4 py-2">{row.narration}</td>
									<td class="px-4 py-2">{row.debit > 0 ? `₹${fmt(row.debit)}` : ''}</td>
									<td class="px-4 py-2">{row.credit > 0 ? `₹${fmt(row.credit)}` : ''}</td>
									<td class="px-4 py-2">
										<select
											value={row.cashFlowType}
											onchange={(e) => updateEntry(row.voucherNumber, (e.target as HTMLSelectElement).value as any, row.includeInCapitalFlow)}
											class="rounded-md border border-border bg-background px-2 py-1 text-xs"
										>
											<option value="deposit">Deposit</option>
											<option value="withdrawal">Withdrawal</option>
											<option value="other">Other</option>
										</select>
									</td>
									<td class="px-4 py-2">
										<input
											type="checkbox"
											checked={row.includeInCapitalFlow}
											onchange={(e) => updateEntry(row.voucherNumber, row.cashFlowType, (e.target as HTMLInputElement).checked)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/await}
		</CardContent>
	</Card>
</div>
