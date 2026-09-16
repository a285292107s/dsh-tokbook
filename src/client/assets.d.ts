/**
 * 客户端引用的静态资产。
 *
 * 只有 hero 底图一张（`assets/hero-yanagi.jpg`）。`tsc` 不认识图片导入，所以这里给它一个
 * 声明：导出的是 **data URI 字符串**，不是 URL——esbuild 在 `scripts/build-client.mjs` 里按
 * `.jpg → dataurl` 内联（client 半区只有一个产物，没有能挂相对 URL 的静态目录）。
 * 声明写的是本仓库的真实行为，不是「图片通常是什么」。
 */
declare module '*.jpg' {
  const dataUri: string
  export default dataUri
}
