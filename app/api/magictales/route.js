export const runtime = "nodejs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { put } from "@vercel/blob";

const CITY = { id:'toronto', name:'Toronto', landmarks:[
  { id:'cntower', name:'CN Tower', tags:['iconic','viewpoint'], imageHints:['glass observation deck','city skyline','distinctive antenna'] },
  { id:'toronto_zoo', name:'Toronto Zoo', tags:['zoo','nature'], imageHints:['zoo gate','animal habitats','greenery'] },
  { id:'st_lawrence_market', name:'St. Lawrence Market', tags:['food','historic'], imageHints:['red-brick facade','market stalls','peameal bacon'] },
]};

const TEMPLATE = [
  { id:'intro', type:'intro', copy:{ heading:'Hello, {{child_name}}!', body:'Welcome to {{city_name}}. Today’s journey will be full of wonder, smiles, and real places you can visit!' }, image:{ base:"whimsical children's illustration, portrait 8.5x11", subject:'{{child_name}} {{avatar_desc}} waves at a big welcome sign for {{city_name}}', context:'friendly locals, soft clouds', constraints:['no text on image','hero centered'] } },
  { id:'iconic', type:'landmark', select:{ tagIn:['iconic','viewpoint'] }, copy:{ heading:'A Towering Start', body:'{{child_name}} looks up at {{landmark_name}} and takes a deep breath. This place is famous for a reason!' }, image:{ base:'bold color, child-friendly', subject:'{{child_name}} {{avatar_desc}} at {{landmark_name}}', context:'include {{landmark_visuals}}; show surrounding skyline', constraints:['full-body hero','recognizable landmark'] } },
  { id:'nature', type:'landmark', select:{ tagIn:['park','zoo','nature'] }, copy:{ heading:'Nature Break', body:'At {{landmark_name}}, {{child_name}} spots something special. The air smells fresh, and the day feels magical.' }, image:{ base:'lush greenery, gentle light', subject:'{{child_name}} exploring {{landmark_name}}', context:'include {{landmark_visuals}}; animals or water if relevant', constraints:[] } },
  { id:'closing', type:'closing', copy:{ heading:'What a Day!', body:'{{child_name}} visited {{visited_landmarks_list}} in {{city_name}}. The city is full of stories—and you’re the hero!' }, image:{ base:'warm, cozy ending scene', subject:'{{child_name}} waving goodnight', context:'small collage of tiny landmark icons in the background', constraints:[] } },
];

const THEME = { artDirection:['bright','whimsical','child-friendly','clean outlines'], camera:['eye-level','slight wide-angle'], lighting:['warm daylight','soft glow'], rendering:['smooth shading','no embedded text'], consistency:['keep {{child_name}} face consistent','{{avatar_desc}} unchanged','repeat outfit across scenes'], aspect:'portrait-8.5x11' };

function fillTokens(t, ctx){ return t.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_,k)=>ctx[k]??''); }
function chooseLandmark(tagIn){ if(!tagIn?.length) return CITY.landmarks[0]; return CITY.landmarks.find(l=>l.tags.some(t=>tagIn.includes(t)))||CITY.landmarks[0]; }
class StageError extends Error{ constructor(message, stage){ super(message); this.stage=stage; } }
async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function runReplicate({ prompt, avatarImageUrl }){
  const token = process.env.REPLICATE_API_TOKEN;
  if(!token) throw new StageError('Missing REPLICATE_API_TOKEN','replicate:env');
  const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';
  const version = process.env.REPLICATE_MODEL_VERSION;
  const input = { prompt, seed: Math.floor(Math.random()*1e9) };
  if(avatarImageUrl){ input.image=avatarImageUrl; input.image_url=avatarImageUrl; input.image_urls=[avatarImageUrl]; input.guide_strength=0.85; }
  const payload = version ? { version, input } : { model, input };
  const res = await fetch('https://api.replicate.com/v1/predictions',{ method:'POST', headers:{'Content-Type':'application/json', Authorization:`Token ${token}`}, body: JSON.stringify(payload) });
  if(!res.ok){ throw new StageError(`Replicate create failed (${res.status}): ${await res.text()}`,'replicate:create'); }
  const pred = await res.json();
  let status=pred.status, output=pred.output; const id=pred.id;
  for(let i=0;i<80 && ['starting','processing','queued'].includes(status);i++){ await sleep(800); const poll=await fetch(`https://api.replicate.com/v1/predictions/${id}`,{ headers:{ Authorization:`Token ${token}` } }); if(!poll.ok){ throw new StageError(`Replicate poll failed (${poll.status})`,'replicate:poll'); } const data=await poll.json(); status=data.status; output=data.output; if(['succeeded','failed','canceled'].includes(status)){ if(status!=='succeeded') throw new StageError(`Replicate status: ${status}; error: ${data.error||'n/a'}`,'replicate:status'); break; } }
  if(!output) throw new StageError('Replicate output empty','replicate:empty');
  let url=null; if(Array.isArray(output)) url=output[0]; else if(typeof output==='object'){ url=output.image || output.url || (Array.isArray(output.images)? output.images[0] : null) || output[0]; } else if(typeof output==='string') url=output;
  if(!url) throw new StageError('Unknown replicate output shape','replicate:shape');
  return url;
}

async function uploadBufferToBlob(path, arrayBuffer, contentType){ const buf = Buffer.from(arrayBuffer); const { url } = await put(path, buf, { access:'public', contentType }); return url; }

export async function GET(){ try{ const pdf=await PDFDocument.create(); pdf.addPage([200,200]); const bytes=await pdf.save(); let blobOk=true; try{ await uploadBufferToBlob(`health/${Date.now()}-ping.txt`, new TextEncoder().encode('ok'), 'text/plain'); } catch { blobOk=false; } return new Response(JSON.stringify({ ok:true, checks:{ replicate_token:Boolean(process.env.REPLICATE_API_TOKEN), pdf_lib: bytes?.length>0, blob_write: blobOk } }), { status:200, headers:{'Content-Type':'application/json'} }); } catch(e){ return new Response(JSON.stringify({ ok:false, stage:'health', error:e?.message||String(e) }), { status:500 }); } }

export async function POST(req){
  try{
    const body = await req.json().catch(()=>({}));
    const childName = body.childName || 'Ella';
    const avatarDesc = body.avatarDesc || 'curly-haired child, joyful smile, friendly';
    const avatarImageUrl = body.avatarImageUrl || null;
    const pagesToMake = Math.min(Math.max(body.pageCount||4,2),12);

    const visited=[], built=[];
    for(const beat of TEMPLATE){
      let landmark=null; if(beat.type==='landmark'){ landmark=chooseLandmark(beat.select?.tagIn); visited.push(landmark); }
      const ctx={ city_name:CITY.name, child_name:childName, avatar_desc:avatarDesc, landmark_name:landmark?.name||'', visited_landmarks_list:visited.map(v=>v.name).join(', '), landmark_visuals:(landmark?.imageHints||[]).join(', ') };
      const prompt=[ beat.image.base, fillTokens(beat.image.subject,ctx), fillTokens(beat.image.context,ctx), ...(beat.image.constraints||[]), ...THEME.artDirection, ...THEME.camera, ...THEME.lighting, ...THEME.rendering, ...THEME.consistency.map(h=>fillTokens(h,ctx)), avatarImageUrl?`use reference image: ${avatarImageUrl}`:'', `aspect: ${THEME.aspect}` ].filter(Boolean).join(' | ');
      built.push({ id:beat.id, heading: fillTokens(beat.copy.heading,ctx), body: fillTokens(beat.copy.body,ctx), prompt });
    }
    const selected = built.slice(0, pagesToMake);

    const DRY_RUN = process.env.DRY_RUN === '1';
    const imageUrls=[];
    if(!DRY_RUN){
      for(const p of selected){
        const genUrl = await runReplicate({ prompt:p.prompt, avatarImageUrl });
        const img = await fetch(genUrl); const arr = await img.arrayBuffer();
        const blobUrl = await uploadBufferToBlob(`pages/${Date.now()}-${Math.random().toString(36).slice(2)}.png`, arr, 'image/png');
        p.imageUrl = blobUrl; imageUrls.push(blobUrl);
      }
    }

    const pdf = await PDFDocument.create(); const width=612, height=792;
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<(imageUrls.length||selected.length);i++){
      const page = pdf.addPage([width,height]);
      if(imageUrls[i]){
        const res = await fetch(imageUrls[i]); const ab = await res.arrayBuffer();
        let img; try{ img=await pdf.embedPng(ab); } catch { img=await pdf.embedJpg(ab); }
        const { width:iw, height:ih } = img.scale(1); const s=Math.min(width/iw, height/ih); const sw=iw*s, sh=ih*s; const x=(width-sw)/2, y=(height-sh)/2;
        page.drawImage(img,{x,y,width:sw,height:sh});
      } else {
        page.drawText(`${selected[i]?.heading || 'MagicTales Page'}`, { x:48, y:height-96, size:18, font, color: rgb(0.2,0.2,0.25) });
        page.drawText(selected[i]?.body || '', { x:48, y:height-130, size:12, font, color: rgb(0.15,0.15,0.2) });
        page.drawText('(DRY_RUN: no image generation)', { x:48, y:64, size:10, font, color: rgb(0.4,0.4,0.5) });
      }
      if(i===0){ page.drawText(`${childName} — ${CITY.name} Adventure`, { x:36, y:height-36, size:14, font, color: rgb(0.2,0.2,0.25) }); }
    }
    const pdfBytes = await pdf.save();
    const pdfUrl = await uploadBufferToBlob(`books/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`, pdfBytes, 'application/pdf');

    return new Response(JSON.stringify({ ok:true, city:CITY.name, pages:selected.map(p=>({ id:p.id, heading:p.heading, body:p.body, prompt:p.prompt, imageUrl:p.imageUrl })), pdfUrl, dryRun: DRY_RUN }), { status:200, headers:{'Content-Type':'application/json'} });
  }catch(e){ return new Response(JSON.stringify({ ok:false, stage:e?.stage||'unknown', error:e?.message||String(e) }), { status:500, headers:{'Content-Type':'application/json'} }); }
}
