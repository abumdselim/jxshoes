/**
 * ক্লায়েন্ট-সাইড AI চ্যাট স্ট্রিমিং হেল্পার
 * Workers AI-এর SSE ফরম্যাট পার্স করে (data: {"response":"..."} ... data: [DONE])
 * শুধু /api/ai রাউটের সাথে কথা বলে — সার্ভার টোকেন ব্রাউজারে যায় না।
 */

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChat(
  messages: ChatMsg[],
  onDelta: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chat', stream: true, messages }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || 'AI সংযোগে সমস্যা হয়েছে');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const evt of events) {
      const line = evt.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        if (typeof json.response === 'string' && json.response) onDelta(json.response);
        if (json.error) throw new Error(String(json.error));
      } catch (e) {
        // ভাঙা চাংক JSON পার্স এরর হলে স্কিপ, কিন্তু আসল এরর হলে ছড়াতে দাও
        if (e instanceof Error && !/JSON/i.test(e.message)) throw e;
      }
    }
  }
}
