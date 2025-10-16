// Stripe Webhook handler
// Set STRIPE_WEBHOOK_SECRET
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { incCredits, setSubscription, grantMonthly } = require('./_store');

const CREDITS_FOR_PRICE = {
  [process.env.STRIPE_PRICE_PACK_STARTER]: 10,
  [process.env.STRIPE_PRICE_PACK_VALUE]:   30,
  [process.env.STRIPE_PRICE_PACK_MEGA]:    100,
};
const MONTHLY_GRANT_FOR_PRICE = {
  [process.env.STRIPE_PRICE_SUB_STARTER]: 20,
  [process.env.STRIPE_PRICE_SUB_PRO]:     60,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const sig = req.headers['stripe-signature'];
  let event;
  try{
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }catch(err){
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try{
    switch(event.type){
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Try to resolve email
        const email =
          session.customer_details?.email ||
          session.customer_email ||
          session.metadata?.email;
        if(!email) break;

        // Expand line items to map price -> credits or monthly grant
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });

        for(const li of lineItems.data){
          const priceId = li.price?.id;
          if (!priceId) continue;

          if (session.mode === 'payment') {
            const credits = CREDITS_FOR_PRICE[priceId] || 0;
            if (credits > 0) {
              await incCredits(email, credits);
              console.log(`[credits] +${credits} for ${email}`);
            }
          } else if (session.mode === 'subscription') {
            const monthly = MONTHLY_GRANT_FOR_PRICE[priceId] || 0;
            // Mark subscription as active + grant welcome credits = monthly
            await setSubscription(email, { active:true, plan: priceId, monthly_grant: monthly });
            if (monthly > 0) {
              await incCredits(email, monthly);
              console.log(`[sub] activated ${email}, granted welcome ${monthly}`);
            }
          }
        }
        break;
      }

      // Monthly recurring credit grant
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Attach email via customer lookup
        if (!invoice.customer) break;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const email = customer?.email;
        if(!email) break;

        // Map the first subscription item price to monthly grant
        const priceId = invoice.lines?.data?.[0]?.price?.id;
        const monthly = MONTHLY_GRANT_FOR_PRICE[priceId] || 0;
        if (monthly > 0) {
          await grantMonthly(email, monthly);
          await setSubscription(email, { active:true, plan: priceId, monthly_grant: monthly });
          console.log(`[sub] monthly grant ${monthly} to ${email}`);
        }
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.updated': {
        // Keep it simple: if status !== active, mark inactive
        const sub = event.data.object;
        const customerId = sub.customer;
        if (!customerId) break;
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer?.email;
        if (!email) break;
        const active = sub.status === 'active';
        await setSubscription(email, { active, plan: sub.items?.data?.[0]?.price?.id, monthly_grant: 0 });
        console.log(`[sub] ${active ? 'active' : 'inactive'} for ${email}`);
        break;
      }

      default:
        // ignore others
        break;
    }
  }catch(err){
    console.error('Webhook handler error', err);
    return res.status(500).send('Webhook handler error');
  }

  res.json({ received: true });
};

// Helpers
async function buffer(req){
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
