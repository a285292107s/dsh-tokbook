/**
 * 用量明细一行的占比环：与额度表盘、价格表盘同族的描边环（轨道淡墨、弧主墨、12 点起算），
 * 环心是 `formatShare` 的读数。整圆就是分母——「占谁的多少」里百分号由环本身承担。
 */

import { formatShare, share } from './format.ts'

/** 环几何按像素尺度固定：44px 与额度表盘同档，行高由它定（两行身份文字只有 39px）。 */
const R = 11
const CIRC = 2 * Math.PI * R
const PX = 44

export function ShareRing({ value, total, denom }: {
  value: number
  total: number
  /** 分母的读法（本窗口 / 本通道）：环心只有数字，这句话由只给读屏的前缀补全。 */
  denom: string
}) {
  const label = formatShare(value, total)
  return (
    <span className="dtpl-share-ring">
      <svg viewBox="-13.5 -13.5 27 27" width={PX} height={PX} aria-hidden="true">
        <circle className="dtpl-share-ring-track" cx="0" cy="0" r={R} />
        <circle
          className="dtpl-share-ring-arc"
          cx="0"
          cy="0"
          r={R}
          transform="rotate(-90)"
          strokeDasharray={`${(share(value, total) / 100) * CIRC} ${CIRC}`}
        />
      </svg>
      <span className="dtpl-share-ring-num">
        <span className="dtpl-sr">占{denom} </span>{label.endsWith('%') ? label.slice(0, -1) : label}<i>%</i>
      </span>
    </span>
  )
}
