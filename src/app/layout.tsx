import './globals.css'
import AuthButton from '@/components/AuthButton'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="p-4 border-b">
          <AuthButton />
        </header>

        {children}
      </body>
    </html>
  )
}
