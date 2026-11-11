import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="py-12">
      <h1 className="font-display text-26">This page does not exist</h1>
      <p className="mt-3 text-ink-2">
        Go back to <Link to="/build" className="text-signal underline underline-offset-4">your build</Link>.
      </p>
    </div>
  )
}
