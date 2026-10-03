// টাইমজোন-নির্ভর হিসাব (finance dayKey 'en-CA') সব মেশিনে এক ফল দিতে UTC ফিক্স
process.env.TZ = 'UTC';

// টেস্টে generatedEnv-এর প্লেসহোল্ডার খালি থাকে — adminAuth-এর টেস্টগুলো
// process.env.ADMIN_PASSWORD স্টাব করে চলে (প্রতি ফাইলে সেট/রিসেট করা হয়)।
