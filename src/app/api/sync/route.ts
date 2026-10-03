import { NextResponse } from 'next/server';
import { getStoreData, getNotifications, countUnreadNotifications } from '@/lib/store';
import { isAdminRequest } from '@/lib/adminAuth';

export const runtime = 'edge';

/**
 * অফলাইন সিঙ্ক স্ন্যাপশট:
 * - অ্যাডমিন (sk_admin কুকি): পূর্ণ FullStoreData + notifications + rev — অফলাইন অ্যাডমিনের উৎস
 * - পাবলিক (শপ ভিজিটর): শুধু স্টোরফ্রন্ট-সেফ ডেটা (প্রোডাক্ট/ক্যাটাগরি/সেটিংস/ব্যানার/ডিল/কুপন) —
 *   অর্ডার, কাস্টমার, বাকি, খরচ, ক্রয়মূল্য-হিসাব কখনোই পাবলিকে যায় না
 * rev = পরিবর্তন শনাক্তে সাহায্য করা হালকা চেকসাম।
 */
export async function GET(request: Request) {
  try {
    const admin = await isAdminRequest(request);
    const data = await getStoreData();

    if (!admin) {
      // পাবলিক স্কোপ — স্টোরফ্রন্ট চালানোর জন্য যা যা দরকার শুধু তাই
      return NextResponse.json({
        scope: 'public',
        data: {
          products: data.products,
          categories: data.categories,
          storeSettings: data.storeSettings,
          heroBanner: data.heroBanner,
          flashDeal: data.flashDeal,
          coupons: data.coupons,
          orders: [],
          customers: [],
          expenses: [],
          duePayments: [],
          inventoryMovements: [],
        },
        notifications: [],
        rev: data.products.length * 31 + data.categories.length * 17,
        serverTime: new Date().toISOString(),
      });
    }

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(),
      countUnreadNotifications(),
    ]);

    return NextResponse.json({
      scope: 'admin',
      data,
      notifications,
      unreadCount,
      rev:
        data.orders.length * 31 +
        data.products.length * 17 +
        (data.customers?.length || 0) * 7 +
        (data.expenses?.length || 0) * 3,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync snapshot error:', error);
    return NextResponse.json({ error: 'সিঙ্ক স্ন্যাপশট আনতে ব্যর্থ' }, { status: 500 });
  }
}
