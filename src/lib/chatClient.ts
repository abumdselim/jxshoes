/**
 * ক্লায়েন্ট-সাইড AI চ্যাট স্ট্রিমিং হেল্পার
 * সার্ভারের AI SSE ফরম্যাট পার্স করে (data: {"response":"..."} ... data: [DONE])
 * শুধু /api/ai রাউটের সাথে কথা বলে — সার্ভার টোকেন ব্রাউজারে যায় না।
 */

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** এজেন্ট চ্যাটের বিশেষ ইভেন্ট হ্যান্ডলার — টুল চিপ, কনফার্ম কার্ড, কাজ-সম্পন্ন চিপ */
export interface ChatStreamHandlers {
  onTool?: (tool: { name: string; label: string }) => void;
  onConfirm?: (confirm: { type: 'sale' | 'due-payment' | 'new-product'; message: string; payload: Record<string, unknown> }) => void;
  onDone?: (done: { message: string; undoAvailable?: boolean; undoPayload?: Record<string, unknown> }[]) => void;
}

export async function streamChat(
  messages: ChatMsg[],
  onDelta: (text: string) => void,
  handlers?: ChatStreamHandlers
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
        // এজেন্ট ইভেন্ট: টুল চিপ / কনফার্মেশন কার্ড / কাজ-সম্পন্ন
        if (json.tool && typeof json.tool === 'object') {
          handlers?.onTool?.(json.tool);
          continue;
        }
        if (json.confirm && typeof json.confirm === 'object') {
          handlers?.onConfirm?.(json.confirm);
          continue;
        }
        if (Array.isArray(json.done)) {
          handlers?.onDone?.(json.done);
          continue;
        }
        // সার্ভার AI স্ট্রিমিং: OpenAI-স্টাইল delta.content (llama + gemma দুটোই);
        // legacy "response" ফিল্ডও ফলব্যাক হিসেবে রাখা। Gemma-র reasoning_content
        // চাংকগুলো delta.content খালি রাখে — অটোমেটিক স্কিপ হয়ে যায়।
        let delta: string | null = null;
        const d = json?.choices?.[0]?.delta;
        if (d && typeof d.content === 'string' && d.content) delta = d.content;
        else if (typeof json.response === 'string' && json.response) delta = json.response;
        if (delta) onDelta(delta);
        if (json.error) throw new Error(String(json.error));
      } catch (e) {
        // ভাঙা চাংক JSON পার্স এরর হলে স্কিপ, কিন্তু আসল এরর হলে ছড়াতে দাও
        if (e instanceof Error && !/JSON/i.test(e.message)) throw e;
      }
    }
  }
}
