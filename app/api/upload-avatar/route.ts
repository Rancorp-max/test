import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    const arr = await file.arrayBuffer();
    const buf = Buffer.from(arr);
    const filename = `avatars/${Date.now()}-${file.name}`;
    const { url } = await put(filename, buf, { access: 'public', contentType: file.type || 'image/jpeg' });
    return NextResponse.json({ ok: true, url });
  } catch (e:any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
