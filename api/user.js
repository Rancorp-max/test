// GET /api/user?email=you@example.com
const { getUser } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try{
    const user = await getUser(email);
    res.status(200).json({ ok:true, user });
  }catch(err){
    console.error('user error', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
};
