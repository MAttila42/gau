<script lang='ts'>
  import { auth } from '$lib/auth.svelte'
  import '@unocss/reset/tailwind.css'
  import 'virtual:uno.css'
</script>

<main class='relative min-h-screen bg-zinc-900 p-6 font-mono text-emerald-100'>
  <div
    class='pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_1px,#18181b_1px),linear-gradient(90deg,transparent_1px,#18181b_1px)] bg-[size:32px_32px] opacity-20'
  ></div>
  <div class='relative mx-auto max-w-3xl space-y-6'>
    {#if auth.session?.user}
      <div
        class='flex items-center justify-between rounded border border-emerald-900/30 bg-zinc-800/50 p-4 backdrop-blur'
      >
        <h2 class='text-xl tracking-tight'>> {auth.session.user.name}</h2>
        <button
          class='rounded border border-red-900/30 bg-red-900/20 px-4 py-2 text-sm tracking-wider transition-all duration-200 hover:border-red-800/50 hover:bg-red-900/40'
          onclick={() => auth.signOut()}
        >
          /logout
        </button>
      </div>
    {:else}
      <div class='flex flex-col items-center gap-4'>
        <span class='text-lg tracking-wider'>Sign In</span>
        <div class='flex justify-center gap-4'>
          <button
            class='flex items-center gap-2 justify-center rounded border border-emerald-900/30 bg-zinc-800 py-2 px-4 transition-all duration-200 hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('github')}
          >
            <div class='i-ph:github-logo size-5'></div>
            <p>GitHub</p>
          </button>
          <button
            class='flex items-center gap-2 justify-center rounded border border-emerald-900/30 bg-zinc-800 py-2 px-4 transition-all duration-200 hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('google')}
          >
            <div class='i-ph:google-logo-bold size-5'></div>
            <p>Google</p>
          </button>
          <button
            class='flex items-center gap-2 justify-center rounded border border-emerald-900/30 bg-zinc-800 py-2 px-4 transition-all duration-200 hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('microsoft-entra-id')}
          >
            <div class='i-mdi:microsoft size-5'></div>
            <p>Microsoft</p>
          </button>
        </div>
      </div>
    {/if}
  </div>
</main>
