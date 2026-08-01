export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          overflow: 'hidden',
          background: '#e0e2db',
          userSelect: 'none',
        }}
      >
        {children}
      </body>
    </html>
  );
}
