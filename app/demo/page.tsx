'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface MTPage { id: string; heading: string; body: string; prompt: string; imageUrl?: string; }
interface MTResponse { ok: boolean; city?: string; pages?: MTPage[]; pdfUrl?: string; dryRun?: boolean; error?: string; stage?: string; }
const initialBeats: Omit<MTPage, 'imageUrl'>[] = [
  { id: 'intro', heading: 'Hello, {{child_name}}!', body: 'Welcome to {{city_name}}…', prompt: '(auto)' },
  { id: 'iconic', heading: 'A Towering Start', body: '{{child_name}} looks up at {{landmark_name}}…', prompt: '(auto)' },
  { id: 'nature', heading: 'Nature Break', body: 'At {{landmark_name}}, {{child_name}} spots…', prompt: '(auto)' },
  { id: 'closing', heading: 'What a Day!', body: '{{child_name}} visited {{visited_landmarks_list}}…', prompt: '(auto)' },
];
function classNames(...xs: (string | false | undefined)[]){ return xs.filter(Boolean).join(' '); }
function useToasts(){ const [items, setItems] = useState<{id:string;text:string;tone?:'ok'|'warn'|'err'}[]>([]); const push=(text:string,tone:'ok'|'warn'|'err'='ok')=>{const id=Math.random().toString(36).slice(2); setItems(p=>[...p,{id,text,tone}]); setTimeout(()=>setItems(p=>p.filter(x=>x.id!==id)),4200);}; return {items,push}; }

export default function DeluxeDemoPage(){
  const [health, setHealth] = useState<{replicate?:boolean;blob?:boolean}|null>(null);
  useEffect(()=>{ (async()=>{ try{ const r=await fetch('/api/magictales'); const j=await r.json(); setHealth({replicate:Boolean(j?.checks?.replicate_token), blob:Boolean(j?.checks?.blob_write)});}catch{ setHealth({replicate:false, blob:false}); } })(); },[]);
  const [childName,setChildName]=useState('Ella');
  const [avatarDesc,setAvatarDesc]=useState('curly-haired child, joyful smile');
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [avatarUrl,setAvatarUrl]=useState('');
  const [city,setCity]=useState('Toronto');
  const [pages,setPages]=useState<MTPage[]>(()=>initialBeats.map(b=>({...b})));
  const [include,setInclude]=useState<Record<string,boolean>>({intro:true,iconic:true,nature:true,closing:true});
  const [busy,setBusy]=useState(false);
  const [pdfUrl,setPdfUrl]=useState('');
  const [apiError,setApiError]=useState('');
  const {items:toasts,push}=useToasts();
  const includedPages = useMemo(()=> pages.filter(p=>include[p.id]!==false),[pages,include]);

  async function uploadAvatar(){ if(!avatarFile) return avatarUrl||''; const fd=new FormData(); fd.append('file', avatarFile); const r=await fetch('/api/upload-avatar',{method:'POST',body:fd}); const j=await r.json(); if(!j.ok) throw new Error(j.error||'Avatar upload failed'); setAvatarUrl(j.url); return j.url as string; }

  async function generateAll(){ setBusy(true); setApiError(''); setPdfUrl(''); try{ const url=await uploadAvatar(); const body={ childName, avatarDesc, avatarImageUrl:url||undefined, pageCount:Math.max(2, Math.min(12, includedPages.length)) }; const r=await fetch('/api/magictales',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); const j:MTResponse=await r.json(); if(!j.ok) throw new Error(`${j.stage||'api'}: ${j.error||'Unknown error'}`); const returned=j.pages||[]; const mapped=includedPages.map(p=>{ const hit=returned.find(r=>r.id===p.id)||returned.shift(); return hit?{...p,imageUrl:hit.imageUrl,prompt:hit.prompt,heading:hit.heading,body:hit.body}:p; }); const next=pages.map(p=>{ if(!include[p.id]) return p; const newer=mapped.find(m=>m.id===p.id); return newer||p; }); setPages(next); if(j.pdfUrl) setPdfUrl(j.pdfUrl); if(j.dryRun) push('DRY_RUN active – images are placeholders','warn'); push('Story generated successfully'); } catch(e:any){ setApiError(e.message||String(e)); push('Generation failed','err'); } finally{ setBusy(false); } }

  function move(id:string,dir:-1|1){ setPages(prev=>{ const i=prev.findIndex(p=>p.id===id); if(i<0) return prev; const j=i+dir; if(j<0||j>=prev.length) return prev; const clone=[...prev]; const [it]=clone.splice(i,1); clone.splice(j,0,it); return clone; }); }
  function updatePage(id:string, patch:Partial<MTPage>){ setPages(prev=>prev.map(p=>p.id===id?{...p,...patch}:p)); }
  const fileInputRef=useRef<HTMLInputElement|null>(null);

  return (
    <div className="min-h-screen">
      <div className="fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2">
        {toasts.map(t=> (<div key={t.id} className={classNames('rounded-xl px-4 py-2 text-sm shadow-lg', t.tone==='ok'&&'bg-emerald-600 text-white', t.tone==='warn'&&'bg-amber-500 text-white', t.tone==='err'&&'bg-rose-600 text-white')}>{t.text}</div>))}
      </div>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600/10 grid place-items-center"><span className="text-blue-700 font-black">MT</span></div>
            <div><h1 className="font-bold">MagicTales • Editor</h1><p className="text-xs text-slate-500">Petsona-style</p></div>
          </div>
          <div className="flex gap-2">
            {pdfUrl && (<a href={`/reader?pdf=${encodeURIComponent(pdfUrl)}`} target="_blank" className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">Open Reader</a>)}
            <a href={pdfUrl||'#'} target="_blank" className={classNames('px-3 py-2 rounded-lg border text-sm', pdfUrl ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'opacity-50 pointer-events-none')}>Download PDF</a>
            <button onClick={generateAll} disabled={busy} className={classNames('px-3 py-2 rounded-lg text-sm text-white', busy?'bg-blue-400':'bg-blue-600 hover:bg-blue-700')}>{busy?'Generating…':'Generate Story'}</button>
          </div>
        </div>
      </header>

      <div className="bg-slate-100 border-b">
        <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-slate-600 flex gap-4">
          <span className={classNames('px-2 py-0.5 rounded-md', health?.replicate?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')}>Replicate: {health?.replicate?'OK':'Missing'}</span>
          <span className={classNames('px-2 py-0.5 rounded-md', health?.blob?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')}>Blob: {health?.blob?'OK':'Check'}</span>
          {apiError && <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">{apiError}</span>}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="font-semibold mb-3">1) Hero</h2>
            <label className="block text-sm mb-1">Child name</label>
            <input value={childName} onChange={e=>setChildName(e.target.value)} className="w-full border rounded-md p-2 mb-3"/>
            <label className="block text-sm mb-1">Avatar description</label>
            <textarea value={avatarDesc} onChange={e=>setAvatarDesc(e.target.value)} className="w-full border rounded-md p-2 h-20 mb-3"/>
            <div className="flex items(center) justify-between mb-2"><div className="text-sm font-medium">Avatar image (optional)</div><button onClick={()=>fileInputRef.current?.click()} className="text-blue-700 text-sm hover:underline">Choose file</button></div>
            <input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={e=>setAvatarFile(e.target.files?.[0]||null)} />
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="col-span-2">
                <div className="text-xs text-slate-500">Tips</div>
                <ul className="text-xs text-slate-600 list-disc ml-4"><li>Frontal face, good lighting</li><li>One person in frame</li><li>Neutral expression works best</li></ul>
              </div>
              <div className="border rounded-xl aspect-square overflow-hidden bg-slate-50 flex items-center justify-center">
                {avatarFile ? (<img className="object-cover w-full h-full" src={URL.createObjectURL(avatarFile)} alt='avatar preview'/>) : avatarUrl ? (<img className="object-cover w-full h-full" src={avatarUrl} alt='avatar preview'/>) : (<span className="text-xs text-slate-400">No image</span>)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="font-semibold mb-3">2) City & Options</h2>
            <label className="block text-sm mb-1">City</label>
            <select value={city} onChange={e=>setCity(e.target.value)} className="w-full border rounded-md p-2 mb-4">
              <option>Toronto</option>
            </select>
            <div className="text-xs text-slate-500">Face-lock is automatic when an avatar image is uploaded.</div>
          </div>

          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl p-5 shadow">
            <div className="font-semibold mb-1">Ready?</div>
            <p className="text-sm text-blue-50 mb-3">Generate the full storybook. You can tweak text and regenerate.</p>
            <button onClick={generateAll} disabled={busy} className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-60">{busy?'Generating…':'Generate Storybook'}</button>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="font-semibold">3) Pages</h2><p className="text-xs text-slate-500">Toggle, reorder, and edit copy before generation.</p></div>
              <div className="flex items-center gap-2 text-xs text-slate-500"><span className="px-2 py-1 bg-slate-100 rounded-md">{includedPages.length} / {pages.length} included</span></div>
            </div>
            <ul className="space-y-4">
              {pages.map((p,idx)=> (
                <li key={p.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input type='checkbox' checked={include[p.id]!==false} onChange={e=>setInclude(prev=>({...prev,[p.id]:e.target.checked}))} aria-label={`Include ${p.id}`} />
                      <div className="font-medium">Page {idx+1}: {p.id}</div>
                    </div>
                    <div className="flex gap-2"><button onClick={()=>move(p.id,-1)} className="px-2 py-1 border rounded-md text-xs">↑</button><button onClick={()=>move(p.id, +1)} className="px-2 py-1 border rounded-md text-xs">↓</button></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs mb-1">Heading</label>
                      <input value={p.heading} onChange={e=>updatePage(p.id,{heading:e.target.value})} className="w-full border rounded-md p-2 mb-3"/>
                      <label className="block text-xs mb-1">Body</label>
                      <textarea value={p.body} onChange={e=>updatePage(p.id,{body:e.target.value})} className="w-full border rounded-md p-2 h-24"/>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Prompt (read-only preview)</label>
                      <textarea value={p.prompt} readOnly className="w-full border rounded-md p-2 h-24 text-xs"/>
                      {p.imageUrl ? (<div className="mt-3"><img src={p.imageUrl} alt='page' className="rounded-lg border"/></div>) : (<div className="mt-3 text-xs text-slate-500 border rounded-lg p-3 bg-slate-50">No image yet. Click <em>Generate Storybook</em> above.</div>)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">MagicTales © {new Date().getFullYear()} · Built with Next.js, Replicate, and Vercel Blob</footer>

      {busy && (<div className="fixed inset-0 bg-black/20 backdrop-blur-sm grid place-items-center z-40"><div className="bg-white rounded-2xl shadow p-6 w-[min(96vw,360px)] text-center"><div className="animate-spin h-6 w-6 rounded-full border-2 border-slate-300 border-t-blue-600 mx-auto mb-3"/><div className="font-medium">Generating story…</div><div className="text-xs text-slate-500 mt-1">This can take a minute depending on the model.</div></div></div>)}
    </div>
  );
}
