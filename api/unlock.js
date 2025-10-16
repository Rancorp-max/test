// POST /api/unlock { email }
// Decrements 1 credit OR allows if subscription.active === true
const { getUser, decCredit } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const { email } = req.body || {};
    if(!email) return res.status(400).json({ error: 'Missing email' });

    const user = await getUser(email);
    if (user.subscription?.active) {
      return res.status(200).json({ success:true, remaining: user.credits, subscription:true });
    }

    if ((user.credits || 0) <= 0) {
      return res.status(402).json({ error: 'NO_CREDITS' });
    }

    const updated = await decCredit(email, 1);
    if (!updated) return res.status(402).json({ error: 'NO_CREDITS' });

    res.status(200).json({ success:true, remaining: updated.credits, subscription:false });
  }catch(err){
    console.error('unlock error', err);
    res.status(500).json({ error: 'Unlock failed' });
  }
};
