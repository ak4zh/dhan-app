<script lang="ts">
	import { portfolio } from '$lib/remote/pnl.remote';
	import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	const snapshot = portfolio();

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
	}

	function pnlColor(n: number) {
		if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
		if (n < 0) return 'text-rose-600 dark:text-rose-400';
		return 'text-muted-foreground';
	}

	function pnlBadgeVariant(n: number) {
		if (n > 0) return 'success';
		if (n < 0) return 'danger';
		return 'secondary';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-foreground">Your Portfolio</h1>
			<p class="text-xs text-muted-foreground sm:text-sm">Real-time positions, holdings, and P&L breakdown</p>
		</div>
	</div>

	{#await snapshot}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<Card class="animate-pulse">
					<CardHeader class="pb-2">
						<div class="h-3 w-20 rounded bg-muted"></div>
					</CardHeader>
					<CardContent>
						<div class="h-6 w-32 rounded bg-muted"></div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:then data}
		{#if data.hasIncompleteData}
			<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
				⚠️ Some positions are missing a live market price, so unrealized P&L may be estimated.
			</div>
		{/if}

		<!-- Metric Summary Cards -->
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader class="pb-1 pt-4 px-4 sm:px-6">
					<CardDescription class="text-xs font-medium uppercase tracking-wider">Unrealized P&L</CardDescription>
				</CardHeader>
				<CardContent class="pb-4 px-4 sm:px-6">
					<div class="text-xl font-bold sm:text-2xl {pnlColor(data.totalUnrealized)}">
						{data.totalUnrealized >= 0 ? '+' : ''}₹{fmt(data.totalUnrealized)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-1 pt-4 px-4 sm:px-6">
					<CardDescription class="text-xs font-medium uppercase tracking-wider">
						Realized ({data.realizedPeriod.from.slice(5)} → {data.realizedPeriod.to.slice(5)})
					</CardDescription>
				</CardHeader>
				<CardContent class="pb-4 px-4 sm:px-6">
					<div class="text-xl font-bold sm:text-2xl {pnlColor(data.totalRealized)}">
						{data.totalRealized >= 0 ? '+' : ''}₹{fmt(data.totalRealized)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-1 pt-4 px-4 sm:px-6">
					<CardDescription class="text-xs font-medium uppercase tracking-wider">Charges (Est.)</CardDescription>
				</CardHeader>
				<CardContent class="pb-4 px-4 sm:px-6">
					<div class="text-xl font-bold text-muted-foreground sm:text-2xl">
						₹{fmt(data.totalCharges)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-1 pt-4 px-4 sm:px-6">
					<CardDescription class="text-xs font-medium uppercase tracking-wider">Net P&L (After Charges)</CardDescription>
				</CardHeader>
				<CardContent class="pb-4 px-4 sm:px-6">
					<div class="text-xl font-bold sm:text-2xl {pnlColor(data.netPnlAfterCharges)}">
						{data.netPnlAfterCharges >= 0 ? '+' : ''}₹{fmt(data.netPnlAfterCharges)}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Funds Summary -->
		{#if data.funds}
			<Card class="bg-card/50">
				<CardContent class="py-3 px-4 sm:px-6">
					<div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 sm:text-sm">
						<div>
							<span class="text-muted-foreground block text-[11px] sm:text-xs">Available Balance</span>
							<span class="font-semibold text-foreground">₹{fmt(data.funds.availableBalance)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[11px] sm:text-xs">Utilized Amount</span>
							<span class="font-semibold text-foreground">₹{fmt(data.funds.utilizedAmount)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[11px] sm:text-xs">Collateral</span>
							<span class="font-semibold text-foreground">₹{fmt(data.funds.collateralAmount)}</span>
						</div>
						<div>
							<span class="text-muted-foreground block text-[11px] sm:text-xs">SOD Limit</span>
							<span class="font-semibold text-foreground">₹{fmt(data.funds.sodLimit)}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Open Positions Section -->
		<Card>
			<CardHeader class="border-b border-border py-3 px-4 sm:px-6">
				<div class="flex items-center justify-between">
					<CardTitle class="text-base font-semibold">Open Positions</CardTitle>
					<Badge variant="outline">{data.positions.length}</Badge>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				{#if data.positions.length === 0}
					<p class="p-6 text-center text-sm text-muted-foreground">No open positions.</p>
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

					<!-- Mobile Card View (Visible on mobile) -->
					<div class="divide-y divide-border md:hidden">
						{#each data.positions as p (p.symbol + p.productType)}
							<div class="p-4 space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="font-semibold text-sm">{p.symbol}</span>
										<Badge variant="outline" class="text-[10px]">{p.exchange}</Badge>
									</div>
									<Badge variant={pnlBadgeVariant(p.unrealized)} class="text-xs">
										{p.unrealized >= 0 ? '+' : ''}₹{fmt(p.unrealized)}
									</Badge>
								</div>
								<div class="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">Qty</span>
										<span>{p.netQty}</span>
									</div>
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">Avg</span>
										<span>₹{fmt(p.avgPrice)}</span>
									</div>
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">LTP</span>
										<span>{p.ltpAvailable ? `₹${fmt(p.ltp ?? 0)}` : '—'}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Holdings Section -->
		<Card>
			<CardHeader class="border-b border-border py-3 px-4 sm:px-6">
				<div class="flex items-center justify-between">
					<CardTitle class="text-base font-semibold">Holdings</CardTitle>
					<Badge variant="outline">{data.holdings.length}</Badge>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				{#if data.holdings.length === 0}
					<p class="p-6 text-center text-sm text-muted-foreground">No holdings.</p>
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

					<!-- Mobile Card View (Visible on mobile) -->
					<div class="divide-y divide-border md:hidden">
						{#each data.holdings as h (h.symbol)}
							<div class="p-4 space-y-2">
								<div class="flex items-center justify-between">
									<span class="font-semibold text-sm">{h.symbol}</span>
									<Badge variant={pnlBadgeVariant(h.unrealized)} class="text-xs">
										{h.unrealized >= 0 ? '+' : ''}₹{fmt(h.unrealized)}
									</Badge>
								</div>
								<div class="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">Qty</span>
										<span>{h.netQty}</span>
									</div>
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">Avg Cost</span>
										<span>₹{fmt(h.avgPrice)}</span>
									</div>
									<div>
										<span class="text-[10px] text-muted-foreground block font-sans">LTP</span>
										<span>{h.ltpAvailable ? `₹${fmt(h.ltp ?? 0)}` : '—'}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{:catch error}
		<Card class="border-destructive/50 bg-destructive/5">
			<CardContent class="p-6">
				<p class="text-sm text-destructive">Couldn't load portfolio data: {error.message}</p>
			</CardContent>
		</Card>
	{/await}
</div>
