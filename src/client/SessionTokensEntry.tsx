import { UsageGlyph } from './icons.tsx'

export interface SessionTokensEntryProps {
  openTokens: () => void
}

export function SessionTokensEntry({ openTokens }: SessionTokensEntryProps) {
  return (
    <button
      type="button"
      className="dtpl-tok-entry"
      data-plugin="dsh-tokbook"
      title="在右侧侧栏打开本会话的词元页"
      onClick={openTokens}
    >
      <UsageGlyph className="dtpl-tok-entry-ico" />
      <span className="dtpl-tok-entry-label">词元</span>
    </button>
  )
}
