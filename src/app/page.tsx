import type { Metadata } from 'next';
import Landing from '@/components/Landing';

export const metadata: Metadata = {
  title: 'Shopkeeper — AI-চালিত দোকান ম্যানেজমেন্ট ও ই-কমার্স সিস্টেম',
  description:
    'অর্ডার, ইনভেন্টরি, হিসাব-নিকাশ, POS ও AI-চালিত ব্যবস্থাপনা — ছোট ও মাঝারি দোকানের জন্য সম্পূর্ণ স্মার্ট ম্যানেজমেন্ট সিস্টেম, সবকিছু এক প্যানেলে।',
};

export default function HomePage() {
  return <Landing />;
}
