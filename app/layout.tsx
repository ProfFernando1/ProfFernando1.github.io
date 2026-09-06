import type { Metadata } from 'next';
import { Geist, Lora } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  weight: '500',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://proffernando1.github.io'),
  title: 'Fernando Coelho | Professor de Física',
  description: 'Fernando Coelho, professor de Física no IFFar e doutorando em Educação na URI. Currículo, ferramentas para estudantes e projetos de divulgação científica.',
  applicationName: 'Fernando Coelho',
  authors: [{ name: 'Fernando José Vinhas Sousa Coelho' }],
  creator: 'Fernando José Vinhas Sousa Coelho',
  alternates: { canonical: '/' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'profile',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Fernando Coelho',
    title: 'Fernando Coelho | Professor de Física',
    description: 'Professor de Física no IFFar e doutorando em Educação na URI. Conheça o currículo e os projetos para estudantes e divulgação científica.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Fernando Coelho — Professor de Física, projetos e recursos digitais',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fernando Coelho | Professor de Física',
    description: 'Professor de Física no IFFar e doutorando em Educação na URI. Conheça o currículo e os projetos para estudantes e divulgação científica.',
    images: ['/og.png'],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          let theme;
          try { theme = localStorage.getItem('fernando-theme'); } catch {}
          document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
        })();` }} />
      </head>
      <body
        className={`${geistSans.variable} ${lora.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
