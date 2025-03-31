import React from "react"
import { prisma } from "@/lib/prisma"
import { getStripeSession, stripe } from "@/lib/stripe"
import { unstable_noStore } from "next/cache"
import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { checkAuthenticationAndSubscription } from "@/lib/checkAuthSubscription"
import ButtonGlowing from "@/components/landingPage/ButtonGlowing"

async function getData(userId: string | null) {
    unstable_noStore()

    if (!userId) return null

    const subscription = await prisma.subscription.findUnique({
        where: {
            userId: userId
        },
        select: {
            status: true,
            user: { select: { stripeCustomerId: true }}
        }
    })

    return subscription
}

export default async function Pricing() {
    // Check authentication status without redirecting
    const authCheck = await checkAuthenticationAndSubscription();
    
    // Get user data if authenticated
    const user = authCheck.isAuthenticated ? await currentUser() : null;
    
    // Get subscription data if authenticated
    const subscription = authCheck.isAuthenticated ? await getData(authCheck.userId) : null;
    
    const isSubscribed = subscription?.status === "active";
    
  

    async function createSubscription() {
        "use server"

        if (!authCheck.userId) {
            return redirect('/sign-in?redirect_url=/pricing')
        }

        let databaseUser = await prisma.user.findUnique({
            where: {
                id: authCheck.userId
            },
            select: {
                stripeCustomerId: true
            }
        })

        if (!databaseUser) {
            throw new Error('DatabaseUser Not Found')
        }

        const email = user?.primaryEmailAddress?.emailAddress
        
        if (!databaseUser.stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: email
            })

            databaseUser = await prisma.user.update({
                where: {
                    id: authCheck.userId
                },
                data: {
                    stripeCustomerId: customer.id
                },
                select: { stripeCustomerId: true }
            })
        }

        if (!databaseUser.stripeCustomerId) {
            throw new Error('Failed to set stripeCustomerId for the user')
        }

        const domainUrl = process.env.NEXT_PUBLIC_URL || 
            (process.env.NODE_ENV === 'production' 
                ? process.env.PRODUCTION_URL 
                : 'http://localhost:3000')

        if (!domainUrl) {
            throw new Error('Missing domain URL configuration')
        }

        const subscriptionUrl = await getStripeSession({
            customerId: databaseUser.stripeCustomerId,
            domainUrl: domainUrl,
            priceId: process.env.STRIPE_PRICE_ID as string,
            successUrl: `${domainUrl}/dashboard?payment=success`
        })

        return redirect(subscriptionUrl)
    }


    async function createCustomerPortal(){
        "use server"

        if (!authCheck.userId) {
            return redirect('sign-in?redirect_url=/pricing')
        }

        const customerPortalUrl = await stripe.billingPortal.sessions.create({
            customer: subscription?.user.stripeCustomerId as string,
            return_url: process.env.NODE_ENV === 'production' ? (process.env.PRODUCTION_URL as string) : 'http://localhost:3000'
        })

        return redirect(customerPortalUrl.url)
    }

    const backLink = authCheck.isAuthenticated ? '/dashboard' : '/';

    return (
        <div className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
                <Link 
                    href={backLink} 
                    className="text-white/70 hover:text-white inline-flex items-center mb-8 transition-all duration-300 
                                    hover:shadow-[0_2px_8px_0] hover:shadow-purple-400/40 hover:rounded-md px-4 py-2"
                >
                    &larr; Back
                </Link>
                
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-12 bg-clip-text text-transparent 
                                bg-gradient-to-r from-white to-purple-200">
                    Subscription Plan
                </h1>
                
                <div className="rounded-xl border border-purple-300/10 bg-black/30 shadow-[0_8px_30px_-12px]
                                 shadow-purple-500/20 p-8 backdrop-blur-sm">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-semibold tracking-tight border-b border-purple-300/20 pb-4">
                            Full Access
                        </h2>
                        
                        <div className="space-y-4">
                            <p className="text-white/80 text-lg">Access to all features</p>
                            <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                                $19.99/year
                            </p>
                            
                            <ul className="space-y-2 text-white/70 py-4">
                                <li className="flex items-center">
                                    <span className="mr-2">✓</span> Unlimited PDF processing
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">✓</span> Advanced AI analysis
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">✓</span> Priority support
                                </li>
                            </ul>
                            
                            <div className="pt-4">
                                {authCheck.isAuthenticated ? (
                                    isSubscribed ? (
                                        <form action={createCustomerPortal}>
                                            <button 
                                                type="submit"
                                                className="group relative inline-flex w-full justify-center items-center gap-2 rounded-full bg-black px-6 py-3 text-white transition-all hover:bg-white/5"
                                            >
                                                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF1E56]
                                                 via-[#FF00FF] to-[#00FFFF] opacity-70 blur-sm transition-all group-hover:opacity-100" />
                                                <span className="absolute inset-0.5 rounded-full bg-black/50" />
                                                <span className="relative font-medium">Manage Subscription</span>
                                            </button>
                                        </form>
                                    ) : (
                                        <form action={createSubscription}>
                                            <button 
                                                type="submit"
                                                className="group relative inline-flex w-full justify-center items-center gap-2 
                                                            rounded-full bg-black px-6 py-3 text-white transition-all hover:bg-white/5"
                                            >
                                                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF1E56]
                                                 via-[#FF00FF] to-[#00FFFF] opacity-70 blur-sm transition-all group-hover:opacity-100" />
                                                <span className="absolute inset-0.5 rounded-full bg-black/50" />
                                                <span className="relative font-medium">Subscribe Now</span>
                                            </button>
                                        </form>
                                    )
                                ) : (
                                    <ButtonGlowing text="Sign In to Subscribe" href="/sign-in?redirect_url=/pricing" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}