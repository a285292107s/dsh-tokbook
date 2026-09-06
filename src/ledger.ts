/**
 * Data-directory resolution for dsh-tokbook.
 *
 * The durable per-day token ledger lives under the resolved data directory
 * (default `$DSH_HOME/tokbook`, else `~/.dsh/tokbook`). The dir can be
 * overridden through the `path` config key so a user can point the book at an
 * existing `dsh-token-usage`-style store.
 *
 * @module dsh-tokbook/ledger
 */

import { join } from 'node:path'
import { homedir } from 'node:os'

/** Resolve the data directory: an explicit `path` wins; otherwise
 * `$DSH_HOME/tokbook` (a blank `$DSH_HOME` counts as unset), else
 * `~/.dsh/tokbook`. */
export function defaultDataDir(configPath: string | undefined): string {
  if (configPath !== undefined && configPath !== '') return configPath
  const envHome = process.env.DSH_HOME
  const base = typeof envHome === 'string' && envHome.trim() !== ''
    ? envHome
    : join(homedir(), '.dsh')
  return join(base, 'tokbook')
}
