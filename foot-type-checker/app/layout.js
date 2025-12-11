import './globals.css'

export const metadata = {
  title: '足型診断',
  description: '写真から足型（エジプト型・ギリシャ型・スクエア型）を診断',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
