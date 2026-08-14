<script lang="ts">
	import { listUsers, createUser, removeUser } from '$lib/remote/users.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
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

	const users = listUsers();

	let showAddForm = $state(false);
	let email = $state('');
	let name = $state('');
	let password = $state('');
	let role = $state<'user' | 'admin'>('user');
	let formError = $state<string | null>(null);
	let submitting = $state(false);

	function resetForm() {
		email = '';
		name = '';
		password = '';
		role = 'user';
		formError = null;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		submitting = true;
		try {
			await createUser({ email, name, password, role });
			resetForm();
			showAddForm = false;
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Failed to create user';
		} finally {
			submitting = false;
		}
	}

	async function remove(id: string, label: string) {
		if (!confirm(`Remove "${label}"? This cannot be undone.`)) return;
		try {
			await removeUser({ id });
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to remove user');
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Members</h1>
		<Button
			onclick={() => (showAddForm = !showAddForm)}
			variant={showAddForm ? 'outline' : 'default'}
		>
			{showAddForm ? 'Cancel' : 'Add user'}
		</Button>
	</div>

	{#if showAddForm}
		<Card>
			<CardHeader>
				<CardTitle>Invite a new user</CardTitle>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<Label for="name">Name</Label>
							<Input id="name" bind:value={name} required />
						</div>
						<div class="space-y-1">
							<Label for="email">Email</Label>
							<Input id="email" type="email" bind:value={email} required />
						</div>
						<div class="space-y-1">
							<Label for="password">Initial password</Label>
							<Input id="password" type="password" bind:value={password} minlength={8} required />
							<p class="text-xs text-muted-foreground">
								Share this with them directly — they can change it after signing in.
							</p>
						</div>
						<div class="space-y-1">
							<Label for="role">Role</Label>
							<Select type="single" value={role} onValueChange={(v: string) => (role = v as 'user' | 'admin')}>
								<SelectTrigger id="role" class="w-full">
									{role === 'admin' ? 'Admin' : 'Member'}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="user">Member</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{#if formError}
						<p class="text-sm text-destructive">{formError}</p>
					{/if}

					<Button type="submit" disabled={submitting} class="w-full sm:w-auto">
						{submitting ? 'Creating…' : 'Create user'}
					</Button>
				</form>
			</CardContent>
		</Card>
	{/if}

	{#await users}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{:then rows}
		<Card>
			<CardContent class="p-0">
				{#if rows.length === 0}
					<p class="p-6 text-center text-sm text-muted-foreground">No users yet.</p>
				{:else}
					<!-- Desktop table -->
					<div class="hidden sm:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
									<TableHead></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each rows as u (u.id)}
									<TableRow>
										<TableCell class="font-medium">{u.name}</TableCell>
										<TableCell class="text-muted-foreground">{u.email}</TableCell>
										<TableCell>
											<Badge
												variant={u.role === 'admin' ? 'default' : 'secondary'}
												class="text-[10px]"
											>
												{u.role === 'admin' ? 'Admin' : 'Member'}
											</Badge>
										</TableCell>
										<TableCell class="text-muted-foreground text-sm">
											{new Date(u.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell class="text-right">
											<Button
												variant="ghost"
												size="sm"
												class="text-destructive hover:bg-destructive/10"
												onclick={() => remove(u.id, u.email)}
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
						{#each rows as u (u.id)}
							<div class="flex items-center justify-between p-4">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="font-medium text-sm">{u.name}</span>
										<Badge
											variant={u.role === 'admin' ? 'default' : 'secondary'}
											class="text-[10px]"
										>
											{u.role === 'admin' ? 'Admin' : 'Member'}
										</Badge>
									</div>
									<p class="text-xs text-muted-foreground">{u.email}</p>
									<p class="text-xs text-muted-foreground">
										Joined {new Date(u.createdAt).toLocaleDateString()}
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="text-destructive hover:bg-destructive/10 shrink-0"
									onclick={() => remove(u.id, u.email)}
								>
									Remove
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{/await}
</div>
