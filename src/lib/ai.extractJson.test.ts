import { describe, it, expect } from 'vitest';
import { extractJson } from './ai';

describe('extractJson (AI উত্তর থেকে JSON বের করা)', () => {
  it('খালি/null-মুখী ইনপুট', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson('এখানে JSON নেই')).toBeNull();
  });

  it('সরাসরি JSON অবজেক্ট', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('কোড-ফেন্সে মোড়া json', () => {
    expect(extractJson('```json\n{"a": 1, "b": "x"}\n```')).toEqual({ a: 1, b: 'x' });
    expect(extractJson('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it('আগে-পিছে অতিরিক্ত লেখা সহ্য করে', () => {
    expect(extractJson('অবশ্যই! এই নিন:\n{"ok":true}\nধন্যবাদ।')).toEqual({ ok: true });
  });

  it('অ্যারে-রুট', () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('নেস্টেড ব্রেস — প্রথম { থেকে শেষ } পর্যন্ত', () => {
    expect(extractJson('{"a":{"b":1}}')).toEqual({ a: { b: 1 } });
  });

  it('ভাঙা JSON → null', () => {
    expect(extractJson('{"a":1,,}')).toBeNull();
    expect(extractJson('{a:1}')).toBeNull();
  });
});
