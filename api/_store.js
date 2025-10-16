// Lightweight user store: uses Vercel KV (Upstash) if configured; else in-memory Map.
// Keys are "user:<email>"
const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

let mem = new Map();

async function kvGet(key){
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if(!res.ok) return null;
  const data = await res.json();
  return data?.result ?? null;
}

async function kvSet(key, value){
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });
}

function keyFor(email){ return `user:${email.toLowerCase()}`; }

async function getUser(email){
  const key = keyFor(email);
  if(hasKV){
    const v = await kvGet(key);
    return v || { email, credits: 0, subscription: { active:false, plan:null, monthly_grant:0 } };
  }
  return mem.get(key) || { email, credits: 0, subscription: { active:false, plan:null, monthly_grant:0 } };
}

async function setUser(email, data){
  const key = keyFor(email);
  if(hasKV) { await kvSet(key, data); return; }
  mem.set(key, data);
}

async function incCredits(email, n){
  const u = await getUser(email);
  u.credits = Math.max(0, (u.credits || 0) + n);
  await setUser(email, u);
  return u;
}

async function decCredit(email, n=1){
  const u = await getUser(email);
  if ((u.credits || 0) < n) return null;
  u.credits -= n;
  await setUser(email, u);
  return u;
}

async function setSubscription(email, {active, plan, monthly_grant}){
  const u = await getUser(email);
  u.subscription = { active: !!active, plan: plan || null, monthly_grant: monthly_grant || (u.subscription?.monthly_grant || 0) };
  await setUser(email, u);
  return u;
}

async function grantMonthly(email, n){
  return incCredits(email, n);
}

module.exports = { getUser, setUser, incCredits, decCredit, setSubscription, grantMonthly };
