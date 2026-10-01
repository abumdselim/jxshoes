import type { Metadata } from 'next';
import { Hind_Siliguri } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import CartDrawer from '@/components/CartDrawer';
import MobileBottomNav from '@/components/MobileBottomNav';

const hindSiliguri = Hind_Siliguri({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['bengali'],
  display: 'swap',
  variable: '--font-hind-siliguri',
});

export const metadata: Metadata = {
  title: 'JxShoes & Bags | সেরা জুতা ও ব্যাগের অনলাইন শপ',
  description: 'প্রিমিয়াম কোয়ালিটি লেদার জুতা, স্নিকার্স ও আকর্ষণীয় ব্যাগের বিশ্বস্ত অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সুবিধা।',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className={`scroll-smooth ${hindSiliguri.variable}`}>
      <body className={`${hindSiliguri.className} antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 md:pb-0 font-sans`}>
        <CartProvider>
          {children}
          <CartDrawer />
          <MobileBottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
