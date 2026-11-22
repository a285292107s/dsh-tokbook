import { SessionTokensEntry } from './SessionTokensEntry.tsx'
import { SessionTimingEntry } from './SessionTimingEntry.tsx'

export interface SessionHeaderEntriesProps {
  sessionId?: string
}

export function SessionHeaderEntries({ sessionId }: SessionHeaderEntriesProps) {
  if (sessionId === undefined || sessionId === '') return null
  return (
    <div className="dtpl-ov-group" data-plugin="dsh-tokbook">
      <SessionTokensEntry sessionId={sessionId} />
      <SessionTimingEntry sessionId={sessionId} />
    </div>
  )
}
