import type { Metadata } from 'next';
import Landing from '@/components/Landing';

export const metadata: Metadata = {
  title: 'Shopkeeper — দোকানের সম্পূর্ণ ই-কমার্স ও ম্যানেজমেন্ট সিস্টেম',
  description:
    'অর্ডার, ইনভেন্টরি, হিসাব-নিকাশ, POS ও AI সহকারী — ছোট ও মাঝারি দোকানের জন্য সম্পূর্ণ ম্যানেজমেন্ট সিস্টেম, সম্পূর্ণ আপনার নিজের Cloudflare-এ।',
};

export default function HomePage() {
  return <Landing />;
}
