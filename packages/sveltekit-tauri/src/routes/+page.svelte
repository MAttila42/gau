<script lang='ts'>
  import { useAuth } from '$lib/auth'
  import '@unocss/reset/tailwind.css'
  import 'virtual:uno.css'

  const auth = useAuth()
</script>

<main class='text-emerald-100 font-mono p-6 bg-zinc-900 min-h-screen relative'>
  <div
    class='bg-[linear-gradient(transparent_1px,#18181b_1px),linear-gradient(90deg,transparent_1px,#18181b_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none inset-0 absolute'
  ></div>
  <div class='mx-auto max-w-3xl relative space-y-6'>
    {#if auth.session?.user}
      <div
        class='p-4 border border-emerald-900/30 rounded bg-zinc-800/50 flex items-center justify-between backdrop-blur'
      >
        <h2 class='text-xl tracking-tight'>> {auth.session.user.name}</h2>
        <button
          class='text-sm tracking-wider px-4 py-2 border border-red-900/30 rounded bg-red-900/20 transition-all duration-200 hover:border-red-800/50 hover:bg-red-900/40'
          onclick={() => auth.signOut()}
        >
          /logout
        </button>
      </div>
    {:else}
      <div class='flex flex-col gap-4 items-center'>
        <span class='text-lg tracking-wider'>Sign In</span>
        <div class='flex gap-4 justify-center'>
          <button
            class='px-4 py-2 border border-emerald-900/30 rounded bg-zinc-800 flex gap-2 transition-all duration-200 items-center justify-center hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('github')}
          >
            <div class='i-ph:github-logo size-5'></div>
            <p>GitHub</p>
          </button>
          <button
            class='px-4 py-2 border border-emerald-900/30 rounded bg-zinc-800 flex gap-2 transition-all duration-200 items-center justify-center hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('google')}
          >
            <div class='i-ph:google-logo-bold size-5'></div>
            <p>Google</p>
          </button>
          <button
            class='px-4 py-2 border border-emerald-900/30 rounded bg-zinc-800 flex gap-2 transition-all duration-200 items-center justify-center hover:border-emerald-800/50 hover:bg-zinc-700'
            onclick={() => auth.signIn('microsoft')}
          >
            <div class='i-mdi:microsoft size-5'></div>
            <p>Microsoft</p>
          </button>
        </div>
      </div>
    {/if}
  </div>
</main>
