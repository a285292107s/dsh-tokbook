import { RefreshGlyph } from './icons.tsx'

export function RescanButton({ busy, retry, onRescan }: {
  busy: boolean
  retry: boolean
  onRescan: () => void
}) {
  return (
    <button
      type="button"
      className={`dtpl-rescan${retry ? ' dtpl-rescan-retry' : ''}`}
      onClick={onRescan}
      disabled={busy}
    >
      <RefreshGlyph className={`dtpl-rescan-ico${busy ? ' dtpl-spin' : ''}`} />
      {busy ? '扫描中…' : retry ? '重试' : '重新扫描'}
    </button>
  )
}
