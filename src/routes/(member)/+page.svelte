<script lang="ts">
	import { portfolio } from '$lib/remote/pnl.remote';
	import { managerPerformance } from '$lib/remote/capital.remote';
	import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	const snapshot = portfolio();

	let feePercent = $state(15);
	let savingsRate = $state(7);
	let perf = $derived(managerPerformance({ feePercent, savingsRate }));

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
	}

	function pnlColor(n: number) {
		if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
		if (n < 0) return 'text-rose-600 dark:text-rose-400';
		return 'text-muted-foreground';
	}
</script>

<div class="space-y-3 sm:space-y-6">
	<div class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Your Portfolio</h1>
			<p class="text-[11px] text-muted-foreground sm:text-sm">Real-time positions, holdings, and P&L breakdown</p>
		</div>
	</div>

	{#await snapshot}
		<div class="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
			{#each Array(4) as _}
				<Card class="animate-pulse">
					<CardHeader class="p-3 sm:pb-2">
						<div class="h-3 w-16 rounded bg-muted"></div>
					</CardHeader>
					<CardContent class="px-3 pb-3 sm:pb-4">
						<div class="h-5 w-24 rounded bg-muted"></div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:then data}
		{#if data.hasIncompleteData}
			<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 sm:p-3 text-xs text-amber-700 dark:text-amber-300">
				⚠️ Some positions are missing a live market price, so unrealized P&L may be estimated.
			</div>
		{/if}

		<!-- Metric Summary Cards: 2x2 on mobile for maximum density -->
		<div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
			<Card>
				<CardContent class="p-2.5 sm:p-4">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Unrealized P&L</p>
					<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.totalUnrealized)}">
						{data.totalUnrealized >= 0 ? '+' : ''}₹{fmt(data.totalUnrealized)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-2.5 sm:p-4">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs truncate">
						Realized ({data.realizedPeriod.from.slice(5)} → {data.realizedPeriod.to.slice(5)})
					</p>
					<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.totalRealized)}">
						{data.totalRealized >= 0 ? '+' : ''}₹{fmt(data.totalRealized)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-2.5 sm:p-4">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Taxes & Charges</p>
					<div class="mt-0.5 text-base font-bold text-muted-foreground sm:text-2xl">
						-₹{fmt(data.totalCharges)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-2.5 sm:p-4">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Net P&L (After Charges)</p>
					<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.netPnlAfterCharges)}">
						{data.netPnlAfterCharges >= 0 ? '+' : ''}₹{fmt(data.netPnlAfterCharges)}
					</div>
					<p class="text-[9px] text-muted-foreground font-mono truncate mt-0.5 hidden sm:block">
						Gross (₹{fmt(data.grossNetPnl)}) - Charges (₹{fmt(data.totalCharges)})
					</p>
				</CardContent>
			</Card>
		</div>

		<!-- Funds Summary: 4-column single row on mobile -->
		{#if data.funds}
			<Card class="bg-card/50">
				<CardContent class="py-2 px-3 sm:py-3 sm:px-6">
					<div class="grid grid-cols-4 gap-1.5 text-center text-xs sm:text-left sm:text-sm">
						<div>
							<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Available</span>
							<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.availableBalance)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Utilized</span>
							<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.utilizedAmount)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Collateral</span>
							<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.collateralAmount)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">SOD Limit</span>
							<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.sodLimit)}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Manager Performance Section -->
		<Card>
			<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
				<div class="flex flex-row items-center justify-between gap-2">
					<div>
						<CardTitle class="text-sm font-semibold sm:text-base">Performance</CardTitle>
						<CardDescription class="text-[10px] sm:text-xs hidden sm:block">
							Net portfolio value after performance fee vs. savings account benchmark
						</CardDescription>
					</div>
					<div class="flex items-center gap-2 text-[11px] sm:text-xs shrink-0">
						<div class="flex items-center gap-1">
							<Label for="memberFeePercent" class="text-[10px] sm:text-xs text-muted-foreground">Fee%:</Label>
							<Input id="memberFeePercent" type="number" step="0.5" bind:value={feePercent} class="h-6 w-14 sm:h-7 sm:w-16 text-[11px] sm:text-xs px-1.5" />
						</div>
						<div class="flex items-center gap-1">
							<Label for="memberSavingsRate" class="text-[10px] sm:text-xs text-muted-foreground">Sav%:</Label>
							<Input id="memberSavingsRate" type="number" step="0.5" bind:value={savingsRate} class="h-6 w-14 sm:h-7 sm:w-16 text-[11px] sm:text-xs px-1.5" />
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent class="p-2.5 sm:p-6">
				{#await perf}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
						{#each Array(6) as _}
							<div class="h-12 rounded-md bg-muted/40 animate-pulse"></div>
						{/each}
					</div>
				{:then p}
					{#if p.warnings && p.warnings.length > 0}
						<div class="mb-2.5 space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
							{#each p.warnings as w}
								<p>⚠️ {w}</p>
							{/each}
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
						<div class="rounded-lg border border-border bg-card p-2 sm:p-3">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Deposited / Withdrawn</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono truncate">₹{fmt(p.totalDeposited)} / ₹{fmt(p.totalWithdrawn)}</p>
						</div>
						<div class="rounded-lg border border-border bg-card p-2 sm:p-3">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Realized Profit</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono truncate {pnlColor(p.cumulativeRealizedProfit)}">
								{p.cumulativeRealizedProfit >= 0 ? '+' : ''}₹{fmt(p.cumulativeRealizedProfit)}
							</p>
						</div>
						<div class="rounded-lg border border-border bg-card p-2 sm:p-3">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Est. Fee ({p.feePercent}%)</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono text-muted-foreground truncate">₹{fmt(p.estimatedFeeOwed)}</p>
						</div>
						<div class="rounded-lg border border-border bg-card p-2 sm:p-3">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Net Value</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono truncate">₹{fmt(p.yourValueAfterEstimatedFee)}</p>
						</div>
						<div class="rounded-lg border border-border bg-card p-2 sm:p-3">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Savings Bench. ({p.savingsAccountRate}%)</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono truncate">₹{fmt(p.savingsAccountBenchmarkValue)}</p>
						</div>
						<div class="rounded-lg border p-2 sm:p-3 {p.benefit >= 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}">
							<p class="text-[9px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">Benefit vs. Savings</p>
							<p class="mt-0.5 text-xs sm:text-base font-semibold font-mono truncate {pnlColor(p.benefit)}">
								{p.benefit >= 0 ? '+' : ''}₹{fmt(p.benefit)}
							</p>
						</div>
					</div>
				{:catch error}
					<p class="text-xs text-destructive">Couldn't load performance metrics: {error.message}</p>
				{/await}
			</CardContent>
		</Card>

		<!-- Open Positions Section -->
		<Card>
			<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm font-semibold sm:text-base">Open Positions</CardTitle>
					<Badge variant="outline" class="text-xs">{data.positions.length}</Badge>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				{#if data.positions.length === 0}
					<p class="p-4 text-center text-xs text-muted-foreground sm:p-6 sm:text-sm">No open positions.</p>
				{:else}
					<!-- Desktop Table View (Hidden on mobile) -->
					<div class="hidden md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Symbol</TableHead>
									<TableHead>Type</TableHead>
									<TableHead class="text-right">Qty</TableHead>
									<TableHead class="text-right">Avg Price</TableHead>
									<TableHead class="text-right">LTP</TableHead>
									<TableHead class="text-right">Unrealized P&L</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.positions as p (p.symbol + p.productType)}
									<TableRow>
										<TableCell class="font-medium">
											{p.symbol}
											<span class="ml-1.5 text-xs text-muted-foreground">({p.exchange})</span>
										</TableCell>
										<TableCell>
											<Badge variant="secondary" class="text-[10px]">{p.productType}</Badge>
										</TableCell>
										<TableCell class="text-right font-mono">{p.netQty}</TableCell>
										<TableCell class="text-right font-mono">₹{fmt(p.avgPrice)}</TableCell>
										<TableCell class="text-right font-mono">
											{p.ltpAvailable ? `₹${fmt(p.ltp ?? 0)}` : '—'}
										</TableCell>
										<TableCell class="text-right font-mono font-semibold {pnlColor(p.unrealized)}">
											{p.ltpAvailable ? `${p.unrealized >= 0 ? '+' : ''}₹${fmt(p.unrealized)}` : 'unavailable'}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Mobile Compact Card/Row View (Visible on mobile) -->
					<div class="divide-y divide-border md:hidden">
						{#each data.positions as p (p.symbol + p.productType)}
							<div class="p-2.5 space-y-1">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-1.5">
										<span class="font-semibold text-xs">{p.symbol}</span>
										<Badge variant="outline" class="text-[9px] px-1 py-0">{p.exchange}</Badge>
										<Badge variant="secondary" class="text-[9px] px-1 py-0">{p.productType}</Badge>
									</div>
									<span class="text-xs font-mono font-semibold {pnlColor(p.unrealized)}">
										{p.unrealized >= 0 ? '+' : ''}₹{fmt(p.unrealized)}
									</span>
								</div>
								<div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5">
									<span>Qty: <strong class="text-foreground font-normal">{p.netQty}</strong></span>
									<span>Avg: <strong class="text-foreground font-normal">₹{fmt(p.avgPrice)}</strong></span>
									<span>LTP: <strong class="text-foreground font-normal">{p.ltpAvailable ? `₹${fmt(p.ltp ?? 0)}` : '—'}</strong></span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Holdings Section -->
		<Card>
			<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm font-semibold sm:text-base">Holdings</CardTitle>
					<Badge variant="outline" class="text-xs">{data.holdings.length}</Badge>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				{#if data.holdings.length === 0}
					<p class="p-4 text-center text-xs text-muted-foreground sm:p-6 sm:text-sm">No holdings.</p>
				{:else}
					<!-- Desktop Table View (Hidden on mobile) -->
					<div class="hidden md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Symbol</TableHead>
									<TableHead class="text-right">Qty</TableHead>
									<TableHead class="text-right">Avg Cost</TableHead>
									<TableHead class="text-right">LTP</TableHead>
									<TableHead class="text-right">Unrealized P&L</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.holdings as h (h.symbol)}
									<TableRow>
										<TableCell class="font-medium">
											{h.symbol}
											<span class="ml-1.5 text-xs text-muted-foreground">({h.exchange})</span>
										</TableCell>
										<TableCell class="text-right font-mono">{h.netQty}</TableCell>
										<TableCell class="text-right font-mono">₹{fmt(h.avgPrice)}</TableCell>
										<TableCell class="text-right font-mono">
											{h.ltpAvailable ? `₹${fmt(h.ltp ?? 0)}` : '—'}
										</TableCell>
										<TableCell class="text-right font-mono font-semibold {pnlColor(h.unrealized)}">
											{h.ltpAvailable ? `${h.unrealized >= 0 ? '+' : ''}₹${fmt(h.unrealized)}` : 'unavailable'}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Mobile Compact Card/Row View (Visible on mobile) -->
					<div class="divide-y divide-border md:hidden">
						{#each data.holdings as h (h.symbol)}
							<div class="p-2.5 space-y-1">
								<div class="flex items-center justify-between">
									<span class="font-semibold text-xs">{h.symbol} <span class="text-[10px] font-normal text-muted-foreground">({h.exchange})</span></span>
									<span class="text-xs font-mono font-semibold {pnlColor(h.unrealized)}">
										{h.unrealized >= 0 ? '+' : ''}₹{fmt(h.unrealized)}
									</span>
								</div>
								<div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5">
									<span>Qty: <strong class="text-foreground font-normal">{h.netQty}</strong></span>
									<span>Avg: <strong class="text-foreground font-normal">₹{fmt(h.avgPrice)}</strong></span>
									<span>LTP: <strong class="text-foreground font-normal">{h.ltpAvailable ? `₹${fmt(h.ltp ?? 0)}` : '—'}</strong></span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{:catch error}
		<Card class="border-destructive/50 bg-destructive/5">
			<CardContent class="p-4 sm:p-6">
				<p class="text-xs text-destructive sm:text-sm">Couldn't load portfolio data: {error.message}</p>
			</CardContent>
		</Card>
	{/await}
</div>
