import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to NotebookLM Clone</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p>
          <Link href="/counter">Go to Counter (Client Component)</Link>
        </p>
        <p>
          <Link href="/server-example">Go to Server Example (Server Component)</Link>
        </p>
      </div>
    </div>
  )
}

