import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Bubble Chat',
  description: 'Twitch + Kick + X chat merged into one markets-native overlay.',
  icons: { icon: '/marketbubble.jpg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
