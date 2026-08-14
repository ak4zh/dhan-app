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
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		Select,
		SelectTrigger,
		SelectContent,
		SelectItem
	} from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';

	const entries = listLedgerEntries();

	let feePercent = $state(15);
	let savingsRate = $state(7);
	let perf = $derived(managerPerformance({ feePercent, savingsRate }));

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
		} catch (err) {
			syncError = err instanceof Error ? err.message : 'Sync failed';
		} finally {
			syncing = false;
		}
	}

	async function updateEntry(
		voucherNumber: string,
		cashFlowType: 'deposit' | 'withdrawal' | 'other',
		includeInCapitalFlow: boolean
	) {
		await updateLedgerEntryClassification({ voucherNumber, cashFlowType, includeInCapitalFlow });
	}

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-xl font-semibold">Manager performance</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Compares your actual portfolio (net of an estimated performance fee) against what the same
			deposits/withdrawals would be worth in a savings account instead.
		</p>
	</div>

	<!-- Sync ledger card -->
	<Card>
		<CardHeader>
			<CardTitle>Sync ledger from Dhan</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
				<div class="space-y-1">
					<Label for="syncFrom">From</Label>
					<Input id="syncFrom" type="date" bind:value={syncFrom} class="w-full sm:w-auto" />
				</div>
				<div class="space-y-1">
					<Label for="syncTo">To</Label>
					<Input id="syncTo" type="date" bind:value={syncTo} class="w-full sm:w-auto" />
				</div>
				<Button onclick={handleSync} disabled={syncing} class="w-full sm:w-auto">
					{syncing ? 'Syncing…' : 'Sync'}
				</Button>
			</div>
			{#if syncError}
				<p class="mt-2 text-sm text-destructive">{syncError}</p>
			{/if}
			{#if syncResult}
				<p class="mt-2 text-sm text-muted-foreground">
					Synced {syncResult.synced} entries{syncResult.skipped > 0
						? ` (${syncResult.skipped} skipped — unparseable date)`
						: ''}.
				</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Assumptions card -->
	<Card>
		<CardHeader>
			<CardTitle>Assumptions</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
				<div class="space-y-1 flex-1">
					<Label for="feePercent">Manager fee (%, above high-water mark)</Label>
					<Input id="feePercent" type="number" step="0.5" bind:value={feePercent} class="w-full" />
				</div>
				<div class="space-y-1 flex-1">
					<Label for="savingsRate">Savings account rate (% p.a.)</Label>
					<Input id="savingsRate" type="number" step="0.5" bind:value={savingsRate} class="w-full" />
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Performance metrics -->
	{#await perf}
		<p class="text-sm text-muted-foreground">Calculating…</p>
	{:then p}
		{#if p.warnings.length > 0}
			<div
				class="space-y-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
			>
				{#each p.warnings as w}
					<p>⚠️ {w}</p>
				{/each}
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<Card>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">Deposited / Withdrawn</p>
					<p class="mt-1 text-lg font-semibold">₹{fmt(p.totalDeposited)} / ₹{fmt(p.totalWithdrawn)}</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">Cumulative realized profit</p>
					<p class="mt-1 text-lg font-semibold">₹{fmt(p.cumulativeRealizedProfit)}</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">Estimated fee owed ({p.feePercent}% above HWM)</p>
					<p class="mt-1 text-lg font-semibold">₹{fmt(p.estimatedFeeOwed)}</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">Your value (net of estimated fee)</p>
					<p class="mt-1 text-lg font-semibold">₹{fmt(p.yourValueAfterEstimatedFee)}</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">
						Savings account benchmark ({p.savingsAccountRate}%)
					</p>
					<p class="mt-1 text-lg font-semibold">₹{fmt(p.savingsAccountBenchmarkValue)}</p>
				</CardContent>
			</Card>
			<Card
				class={p.benefit >= 0
					? 'border-primary bg-primary/5'
					: 'border-destructive bg-destructive/5'}
			>
				<CardContent class="p-4">
					<p class="text-xs text-muted-foreground">Benefit vs. savings account</p>
					<p
						class="mt-1 text-lg font-semibold"
						class:text-primary={p.benefit >= 0}
						class:text-destructive={p.benefit < 0}
					>
						{p.benefit >= 0 ? '+' : ''}₹{fmt(p.benefit)}
					</p>
				</CardContent>
			</Card>
		</div>
	{:catch error}
		<p class="text-sm text-destructive">
			{error?.body?.message ?? error?.message ?? 'Failed to calculate'}
		</p>
	{/await}

	<!-- Ledger entries table -->
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
					<!-- Desktop table -->
					<div class="hidden sm:block overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Narration</TableHead>
									<TableHead class="text-right">Debit</TableHead>
									<TableHead class="text-right">Credit</TableHead>
									<TableHead>Type</TableHead>
									<TableHead class="text-center">Counts</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each rows as row (row.voucherNumber)}
									<TableRow>
										<TableCell class="whitespace-nowrap font-mono text-xs"
											>{row.voucherDate}</TableCell
										>
										<TableCell class="max-w-[200px] text-sm">{row.narration}</TableCell>
										<TableCell class="text-right font-mono text-sm">
											{row.debit > 0 ? `₹${fmt(row.debit)}` : ''}
										</TableCell>
										<TableCell class="text-right font-mono text-sm">
											{row.credit > 0 ? `₹${fmt(row.credit)}` : ''}
										</TableCell>
										<TableCell>
											<Select
												type="single"
												value={row.cashFlowType}
												onValueChange={(v: string) =>
													updateEntry(
														row.voucherNumber,
														v as 'deposit' | 'withdrawal' | 'other',
														row.includeInCapitalFlow
													)}
											>
												<SelectTrigger class="h-8 w-32 text-xs">
													{row.cashFlowType}
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="deposit">Deposit</SelectItem>
													<SelectItem value="withdrawal">Withdrawal</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell class="text-center">
											<Checkbox
												checked={row.includeInCapitalFlow}
												onCheckedChange={(v) =>
													updateEntry(row.voucherNumber, row.cashFlowType, v as boolean)}
											/>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Mobile card view -->
					<div class="divide-y divide-border sm:hidden">
						{#each rows as row (row.voucherNumber)}
							<div class="space-y-3 p-4">
								<div class="flex items-start justify-between gap-2">
									<div>
										<p class="text-xs font-mono text-muted-foreground">{row.voucherDate}</p>
										<p class="mt-0.5 text-sm">{row.narration}</p>
									</div>
									<div class="text-right text-sm font-mono shrink-0">
										{#if row.debit > 0}
											<span class="text-destructive">-₹{fmt(row.debit)}</span>
										{/if}
										{#if row.credit > 0}
											<span class="text-emerald-600 dark:text-emerald-400">+₹{fmt(row.credit)}</span>
										{/if}
									</div>
								</div>
								<div class="flex items-center justify-between gap-3">
									<Select
										type="single"
										value={row.cashFlowType}
										onValueChange={(v: string) =>
											updateEntry(
												row.voucherNumber,
												v as 'deposit' | 'withdrawal' | 'other',
												row.includeInCapitalFlow
											)}
									>
										<SelectTrigger class="h-8 flex-1 text-xs">
											{row.cashFlowType}
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="deposit">Deposit</SelectItem>
											<SelectItem value="withdrawal">Withdrawal</SelectItem>
											<SelectItem value="other">Other</SelectItem>
										</SelectContent>
									</Select>
									<label class="flex items-center gap-2 text-xs text-muted-foreground">
										<Checkbox
											checked={row.includeInCapitalFlow}
											onCheckedChange={(v) =>
												updateEntry(row.voucherNumber, row.cashFlowType, v as boolean)}
										/>
										Include
									</label>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/await}
		</CardContent>
	</Card>
</div>
