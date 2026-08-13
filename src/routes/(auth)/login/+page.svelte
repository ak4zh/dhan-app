<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		loading = true;
		const { error: signInError } = await authClient.signIn.email({ email, password });
		loading = false;
		if (signInError) {
			error = signInError.message ?? 'Sign in failed';
			return;
		}
		const next = page.url.searchParams.get('next') ?? '/';
		await goto(next);
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-muted/20 p-4 antialiased">
	<Card class="w-full max-w-sm shadow-md">
		<CardHeader class="space-y-1">
			<div class="flex items-center gap-2 mb-1">
				<div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-sm">
					D
				</div>
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dhan Trading</span>
			</div>
			<CardTitle class="text-xl font-bold">Sign In</CardTitle>
			<CardDescription class="text-xs">Enter your account credentials to continue</CardDescription>
		</CardHeader>
		<CardContent>
			<form id="login-form" onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-1.5">
					<Label for="email">Email</Label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						placeholder="name@example.com"
						required
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						placeholder="••••••••"
						required
					/>
				</div>

				{#if error}
					<p class="text-xs font-medium text-destructive">{error}</p>
				{/if}
			</form>
		</CardContent>
		<CardFooter>
			<Button form="login-form" type="submit" disabled={loading} class="w-full">
				{loading ? 'Signing in…' : 'Sign In'}
			</Button>
		</CardFooter>
	</Card>
</div>
