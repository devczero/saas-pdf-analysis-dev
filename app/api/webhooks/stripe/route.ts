// Import the NextResponse class from Next.js to handle API responses
import { NextResponse } from 'next/server'
// Import the headers function to access request headers
import { headers } from 'next/headers'
// Import the Stripe type definitions
import Stripe from 'stripe'
// Import our configured Stripe instance from a local module
import { stripe } from '@/lib/stripe'
// Import our Prisma client to interact with the database
import { prisma } from '@/lib/prisma'

// This is the main webhook handler function that Next.js will call when Stripe sends a webhook to our API
// It's an async function that receives the incoming request
export async function POST(req: Request) {
  // Extract the raw body text from the request
  const body = await req.text()
  // Get the Stripe signature from the request headers for verification
  const signature = (await headers()).get("Stripe-Signature") as string

  try {
    // Verify the webhook event using Stripe's SDK
    // This confirms the event came from Stripe using our secret
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Handle different types of Stripe events using a switch statement
    switch (event.type) {
      case 'checkout.session.completed':
        // When a checkout is completed, process the new subscription
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        // When a subscription is updated, update our database
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        // When a subscription is canceled, remove it from our database
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        // When an invoice payment succeeds, update the subscription period
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      default:
        // Log any webhook types we haven't implemented handlers for
        console.warn(`Unhandled event type: ${event.type}`)
    }

    // Return a success response to Stripe
    return NextResponse.json({ received: true }, { status: 200 })

  } catch (err) {
    // Handle any errors during webhook processing
    const error = err as Error
    // Log the error for debugging
    console.error(`Stripe webhook error: ${error.message}`)
    // Return an error response to Stripe
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    )
  }
}

// This function handles the 'checkout.session.completed' event
// It's called when a customer completes the checkout process and subscribes to our service
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Check if the session has both subscription and customer data
  if (!session.subscription || !session.customer) return

  // Retrieve full subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  )

  // Update our database with the new subscription information
  await prisma.user.update({
    // Find the user by their Stripe customer ID
    where: { stripeCustomerId: session.customer as string },
    data: {
      subscription: {
        // Use upsert to either create a new subscription or update an existing one
        upsert: {
          create: mapSubscriptionData(subscription),
          update: mapSubscriptionData(subscription),
        },
      },
    },
  })
}

// This function handles the 'customer.subscription.updated' event
// It's called when a subscription's details change (e.g., plan changes, payment issues)
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Get the first item in the subscription (most subscriptions only have one item)
  const firstItem = subscription.items.data[0]
  
  // Update the subscription record in our database
  await prisma.subscription.update({
    // Find the subscription by its Stripe ID
    where: { stripeSubscriptionId: subscription.id },
    data: {
      // Update the subscription status (active, past_due, canceled, etc.)
      status: subscription.status,
      // Update the billing period start date (convert from Unix timestamp to JavaScript Date)
      // Using ternary operator to check if firstItem.current_period_start exists
      // If it exists, convert the Unix timestamp to JavaScript Date, otherwise use undefined
      // This prevents errors if the property is missing in the Stripe response
      currentPeriodStart: firstItem?.current_period_start 
        ? new Date(firstItem.current_period_start * 1000) 
        : undefined,
      // Update the billing period end date
      // Similar ternary check to handle potential missing data safely
      currentPeriodEnd: firstItem?.current_period_end 
        ? new Date(firstItem.current_period_end * 1000) 
        : undefined,
      // Update the billing interval (month, year, etc.)
      // Using ternary-like OR operation to handle backward compatibility with different Stripe API versions
      // First checks if plan.interval exists, falls back to price.recurring.interval if needed
      interval: firstItem?.plan?.interval || firstItem?.price?.recurring?.interval,
      // Update the plan/price ID
      // Similar OR operation to handle both older plan.id format and newer price.id format
      planId: firstItem?.plan?.id || firstItem?.price?.id,
    },
  })
}

// This function handles the 'customer.subscription.deleted' event
// It's called when a subscription is canceled or expires
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Remove the subscription from our database
  await prisma.subscription.delete({
    where: { stripeSubscriptionId: subscription.id },
  })
}

// This function handles the 'invoice.payment_succeeded' event
// It's called when a recurring payment is successfully processed
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {

  let subscriptionId: string | null = null
  
  if ('subscription' in invoice && invoice.subscription) {
    subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : (invoice.subscription as Stripe.Subscription)?.id || null
  }

  // If no subscription was found, log a warning and exit
  if (!subscriptionId) {
    console.warn('No subscription ID found in invoice')
    return
  }

  // Retrieve the full subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const firstItem = subscription.items.data[0]
  
  // Update the subscription period in our database
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      // Update the billing period dates based on the new invoice
      // Using ternary operators to safely handle potentially missing data
      // If the timestamp exists, convert it to a JavaScript Date, otherwise use undefined
      // This prevents runtime errors if the Stripe response structure changes
      currentPeriodStart: firstItem?.current_period_start 
        ? new Date(firstItem.current_period_start * 1000) 
        : undefined,
      currentPeriodEnd: firstItem?.current_period_end 
        ? new Date(firstItem.current_period_end * 1000) 
        : undefined,
    },
  })
}

// This helper function maps Stripe subscription data to our database schema format
function mapSubscriptionData(subscription: Stripe.Subscription) {
  // Get billing period from the first subscription item
  const firstItem = subscription.items.data[0]
  
  // Return an object with all the subscription data formatted for our database
  return {
    // The unique Stripe subscription ID
    stripeSubscriptionId: subscription.id,
    // The current status of the subscription
    status: subscription.status,
    // Convert Stripe timestamp (in seconds) to JavaScript Date (in milliseconds)
    // These track the current billing period for the subscription
    currentPeriodStart: new Date(firstItem.current_period_start * 1000),
    currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
    interval: firstItem.plan.interval,
    planId: firstItem.plan.id
  }
}
