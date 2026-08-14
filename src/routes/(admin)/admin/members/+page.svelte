<script lang="ts">
	import { listUsers, createUser, removeUser } from '$lib/remote/users.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';

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
		<Button onclick={() => (showAddForm = !showAddForm)}>
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
					<div class="grid grid-cols-2 gap-4">
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
							<p class="text-xs text-muted-foreground">Share this with them directly — they can change it after signing in.</p>
						</div>
						<div class="space-y-1">
							<Label for="role">Role</Label>
							<select id="role" bind:value={role} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
								<option value="user">Member</option>
								<option value="admin">Admin</option>
							</select>
						</div>
					</div>

					{#if formError}
						<p class="text-sm text-destructive">{formError}</p>
					{/if}

					<Button type="submit" disabled={submitting}>
						{submitting ? 'Creating…' : 'Create user'}
					</Button>
				</form>
			</CardContent>
		</Card>
	{/if}

	{#await users}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{:then rows}
		<div class="overflow-hidden rounded-lg border border-border bg-card">
			<table class="w-full text-sm">
				<thead class="border-b border-border bg-muted/50 text-left text-muted-foreground">
					<tr>
						<th class="px-4 py-2 font-medium">Name</th>
						<th class="px-4 py-2 font-medium">Email</th>
						<th class="px-4 py-2 font-medium">Role</th>
						<th class="px-4 py-2 font-medium">Joined</th>
						<th class="px-4 py-2 font-medium"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each rows as u (u.id)}
						<tr>
							<td class="px-4 py-2">{u.name}</td>
							<td class="px-4 py-2">{u.email}</td>
							<td class="px-4 py-2 capitalize">{u.role === 'admin' ? 'Admin' : 'Member'}</td>
							<td class="px-4 py-2 text-muted-foreground">
								{new Date(u.createdAt).toLocaleDateString()}
							</td>
							<td class="px-4 py-2 text-right">
								<Button variant="ghost" size="sm" onclick={() => remove(u.id, u.email)}>Remove</Button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="px-4 py-6 text-center text-muted-foreground">No users yet.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/await}
</div>
