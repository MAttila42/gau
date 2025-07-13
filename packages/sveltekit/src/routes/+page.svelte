<script lang="ts">
  import { auth } from '$lib/auth.svelte'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
  console.log(data)
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

{#if auth.session?.user}
  <p>Signed in as {auth.session.user.name}</p>
  <button onclick={() => auth.signOut()}>Sign Out</button>
{:else}
  <button onclick={() => auth.signIn('github')}>Sign In with GitHub</button>
{/if}

<h2>Session from server:</h2>
<pre>{JSON.stringify(data.session, null, 2)}</pre>
