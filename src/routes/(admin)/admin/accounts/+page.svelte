<script lang="ts">
	import {
		listLinkedAccounts,
		setAccountEnabled,
		setAccountMultiplier,
		addKiteAccount,
		addKotakAccount,
		removeLinkedAccount
	} from '$lib/remote/accounts.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

	const accounts = listLinkedAccounts();

	let showAddForm = $state(false);
	let broker = $state<'kite' | 'kotak_neo'>('kite');
	let formError = $state<string | null>(null);
	let submitting = $state(false);

	// Shared fields
	let id = $state('');
	let label = $state('');
	let multiplier = $state(1);

	// Kite fields
	let kiteApiKey = $state('');
	let kiteApiSecret = $state('');
	let kiteUserId = $state('');
	let kitePassword = $state('');
	let kiteTotpSecret = $state('');

	// Kotak fields
	let kotakConsumerKey = $state('');
	let kotakConsumerSecret = $state('');
	let kotakMobileNumber = $state('');
	let kotakPassword = $state('');
	let kotakTotpSecret = $state('');
	let kotakMpin = $state('');

	function resetForm() {
		id = '';
		label = '';
		multiplier = 1;
		kiteApiKey = kiteApiSecret = kiteUserId = kitePassword = kiteTotpSecret = '';
		kotakConsumerKey =
			kotakConsumerSecret =
			kotakMobileNumber =
			kotakPassword =
			kotakTotpSecret =
			kotakMpin =
				'';
		formError = null;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		submitting = true;
		try {
			if (broker === 'kite') {
				await addKiteAccount({
					id,
					label,
					multiplier,
					kiteApiKey,
					kiteApiSecret,
					kiteUserId,
					kitePassword,
					kiteTotpSecret
				});
			} else {
				await addKotakAccount({
					id,
					label,
					multiplier,
					kotakConsumerKey,
					kotakConsumerSecret,
					kotakMobileNumber,
					kotakPassword,
					kotakTotpSecret,
					kotakMpin
				});
			}
			resetForm();
			showAddForm = false;
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Failed to add account';
		} finally {
			submitting = false;
		}
	}

	async function toggle(accId: string, enabled: boolean) {
		await setAccountEnabled({ id: accId, enabled });
	}

	async function updateMultiplier(accId: string, e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		if (Number.isNaN(value) || value <= 0) return;
		await setAccountMultiplier({ id: accId, multiplier: value });
	}

	async function remove(accId: string) {
		if (!confirm(`Remove account "${accId}"? This cannot be undone.`)) return;
		await removeLinkedAccount({ id: accId });
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Linked Accounts</h1>
			<p class="text-xs text-muted-foreground sm:text-sm">
				Manage trade replication follower accounts
			</p>
		</div>
		<Button
			onclick={() => (showAddForm = !showAddForm)}
			variant={showAddForm ? 'outline' : 'default'}
			class="w-full sm:w-auto"
		>
			{showAddForm ? 'Cancel' : '+ Add Account'}
		</Button>
	</div>

	{#if showAddForm}
		<Card>
			<CardHeader>
				<CardTitle class="text-base font-semibold">Add Follower Account</CardTitle>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-5">
					<!-- Broker selection via Tabs -->
					<div class="space-y-1">
						<Label>Broker</Label>
						<Tabs
							value={broker}
							onValueChange={(v) => (broker = v as 'kite' | 'kotak_neo')}
							class="w-full"
						>
							<TabsList class="w-full sm:w-auto">
								<TabsTrigger value="kite" class="flex-1 sm:flex-none">Kite (Zerodha)</TabsTrigger>
								<TabsTrigger value="kotak_neo" class="flex-1 sm:flex-none">Kotak Neo</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<!-- Common fields -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div class="space-y-1">
							<Label for="id">Account ID (Slug)</Label>
							<Input id="id" bind:value={id} placeholder="kite-dads-account" required />
						</div>
						<div class="space-y-1">
							<Label for="label">Display Label</Label>
							<Input id="label" bind:value={label} placeholder="Dad's Kite Account" required />
						</div>
						<div class="space-y-1">
							<Label for="multiplier">Quantity Multiplier</Label>
							<Input
								id="multiplier"
								type="number"
								step="0.1"
								min="0.01"
								max="10"
								bind:value={multiplier}
								required
							/>
						</div>
					</div>

					<!-- Broker-specific fields -->
					{#if broker === 'kite'}
						<div class="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
							<div class="space-y-1">
								<Label for="kiteApiKey">Kite Connect API Key</Label>
								<Input id="kiteApiKey" bind:value={kiteApiKey} required />
							</div>
							<div class="space-y-1">
								<Label for="kiteApiSecret">Kite Connect API Secret</Label>
								<Input id="kiteApiSecret" type="password" bind:value={kiteApiSecret} required />
							</div>
							<div class="space-y-1">
								<Label for="kiteUserId">Kite Login User ID</Label>
								<Input id="kiteUserId" bind:value={kiteUserId} required />
							</div>
							<div class="space-y-1">
								<Label for="kitePassword">Kite Login Password</Label>
								<Input id="kitePassword" type="password" bind:value={kitePassword} required />
							</div>
							<div class="space-y-1 sm:col-span-2">
								<Label for="kiteTotpSecret">Kite TOTP Secret</Label>
								<Input id="kiteTotpSecret" type="password" bind:value={kiteTotpSecret} required />
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
							<div class="space-y-1">
								<Label for="kotakConsumerKey">Consumer Key</Label>
								<Input id="kotakConsumerKey" bind:value={kotakConsumerKey} required />
							</div>
							<div class="space-y-1">
								<Label for="kotakConsumerSecret">Consumer Secret</Label>
								<Input
									id="kotakConsumerSecret"
									type="password"
									bind:value={kotakConsumerSecret}
									required
								/>
							</div>
							<div class="space-y-1">
								<Label for="kotakMobileNumber">Mobile Number</Label>
								<Input id="kotakMobileNumber" bind:value={kotakMobileNumber} required />
							</div>
							<div class="space-y-1">
								<Label for="kotakPassword">Login Password</Label>
								<Input id="kotakPassword" type="password" bind:value={kotakPassword} required />
							</div>
							<div class="space-y-1">
								<Label for="kotakTotpSecret">TOTP Secret</Label>
								<Input
									id="kotakTotpSecret"
									type="password"
									bind:value={kotakTotpSecret}
									required
								/>
							</div>
							<div class="space-y-1">
								<Label for="kotakMpin">MPIN</Label>
								<Input id="kotakMpin" type="password" bind:value={kotakMpin} required />
							</div>
						</div>
					{/if}

					{#if formError}
						<p class="text-sm font-medium text-destructive">{formError}</p>
					{/if}

					<Button type="submit" disabled={submitting} class="w-full sm:w-auto">
						{submitting ? 'Adding…' : 'Add Account'}
					</Button>
				</form>
			</CardContent>
		</Card>
	{/if}

	{#await accounts}
		<Card class="animate-pulse p-6">
			<div class="h-4 w-32 rounded bg-muted"></div>
		</Card>
	{:then rows}
		<Card>
			<CardContent class="p-0">
				{#if rows.length === 0}
					<p class="p-6 text-center text-sm text-muted-foreground">No accounts linked yet.</p>
				{:else}
					<!-- Desktop table -->
					<div class="hidden sm:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Label</TableHead>
									<TableHead>Broker</TableHead>
									<TableHead class="text-center">Multiplier</TableHead>
									<TableHead class="text-center">Enabled</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each rows as row (row.id)}
									<TableRow>
										<TableCell class="font-semibold">{row.label}</TableCell>
										<TableCell>
											<Badge variant="outline" class="uppercase text-xs">{row.broker}</Badge>
										</TableCell>
										<TableCell class="text-center">
											<Input
												type="number"
												step="0.1"
												min="0.01"
												max="10"
												value={row.multiplier}
												onchange={(e) => updateMultiplier(row.id, e)}
												class="w-20 text-center font-mono mx-auto"
											/>
										</TableCell>
										<TableCell class="text-center">
											<Switch
												checked={row.enabled}
												onCheckedChange={(v: boolean) => toggle(row.id, v)}
											/>
										</TableCell>
										<TableCell class="text-right">
											<Button
												variant="ghost"
												size="sm"
												class="text-destructive hover:bg-destructive/10"
												onclick={() => remove(row.id)}
											>
												Remove
											</Button>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Mobile card view -->
					<div class="divide-y divide-border sm:hidden">
						{#each rows as row (row.id)}
							<div class="space-y-3 p-4">
								<div class="flex items-center justify-between">
									<span class="font-semibold text-sm">{row.label}</span>
									<Badge variant="outline" class="uppercase text-[10px]">{row.broker}</Badge>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div class="space-y-1">
										<Label class="text-xs text-muted-foreground">Multiplier</Label>
										<Input
											type="number"
											step="0.1"
											min="0.01"
											max="10"
											value={row.multiplier}
											onchange={(e) => updateMultiplier(row.id, e)}
											class="h-8 text-center font-mono text-sm"
										/>
									</div>
									<div class="space-y-1">
										<Label class="text-xs text-muted-foreground">Enabled</Label>
										<div class="flex items-center h-8">
											<Switch
												checked={row.enabled}
												onCheckedChange={(v: boolean) => toggle(row.id, v)}
											/>
										</div>
									</div>
								</div>
								<div class="flex justify-end">
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:bg-destructive/10"
										onclick={() => remove(row.id)}
									>
										Remove
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{/await}
</div>
