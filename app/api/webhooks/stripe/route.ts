import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get("Stripe-Signature") as string

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      default:
        console.warn(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })

  } catch (err) {
    const error = err as Error
    console.error(`Stripe webhook error: ${error.message}`)
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!session.subscription || !session.customer) return

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  )

  await prisma.user.update({
    where: { stripeCustomerId: session.customer as string },
    data: {
      subscription: {
        upsert: {
          create: mapSubscriptionData(subscription),
          update: mapSubscriptionData(subscription),
        },
      },
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // get billing period from the first subscription item
  // users subscribe to one plan at a time (e.g. "Pro Plan" or "Monthly Plan")
  // that means the subscription will contain only one item, so it's safe and standard to grab the first item like that
  const firstItem = subscription.items.data[0]
  
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status,
      // In Stripe v18, period dates are on the subscription item level
      currentPeriodStart: firstItem?.current_period_start 
        ? new Date(firstItem.current_period_start * 1000) 
        : null,
      currentPeriodEnd: firstItem?.current_period_end 
        ? new Date(firstItem.current_period_end * 1000) 
        : null,
      interval: firstItem?.plan?.interval || firstItem?.price?.recurring?.interval,
      planId: firstItem?.plan?.id || firstItem?.price?.id,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.delete({
    where: { stripeSubscriptionId: subscription.id },
  })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // In Stripe v18, we need to check if the invoice has a subscription
  // The subscription property might not exist directly on all invoice types
  let subscriptionId: string | null = null
  
  if ('subscription' in invoice && invoice.subscription) {
    subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : (invoice.subscription as Stripe.Subscription)?.id || null
  }

  if (!subscriptionId) {
    console.warn('No subscription ID found in invoice')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const firstItem = subscription.items.data[0]
  
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      // In Stripe v18, period dates are on the subscription item level
      currentPeriodStart: firstItem?.current_period_start 
        ? new Date(firstItem.current_period_start * 1000) 
        : null,
      currentPeriodEnd: firstItem?.current_period_end 
        ? new Date(firstItem.current_period_end * 1000) 
        : null,
    },
  })
}

function mapSubscriptionData(subscription: Stripe.Subscription) {
  // Get billing period from the first subscription item
  const firstItem = subscription.items.data[0]
  
  return {
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    // In Stripe v18, period dates are on the subscription item level
    currentPeriodStart: firstItem?.current_period_start 
      ? new Date(firstItem.current_period_start * 1000) 
      : null,
    currentPeriodEnd: firstItem?.current_period_end 
      ? new Date(firstItem.current_period_end * 1000) 
      : null,
    interval: firstItem?.plan?.interval || firstItem?.price?.recurring?.interval,
    planId: firstItem?.plan?.id || firstItem?.price?.id,
  }
}
