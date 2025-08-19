import { Protected } from '@rttnd/gau/client/solid'

export default Protected(
  session => (
    <main class="text-emerald-100 font-mono p-6 bg-zinc-900 min-h-screen w-full">
      <div class="mx-auto max-w-3xl">
        <h1 class="text-2xl mb-4">Protected Page</h1>
        <p class="mb-4">Only visible to authenticated users.</p>
        <pre class="text-sm p-4 rounded bg-zinc-800 overflow-x-auto">{JSON.stringify(session(), null, 2)}</pre>
      </div>
    </main>
  ),
  '/',
)
