'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function RedirectComponent({ to }: { to: string }) {
  const router = useRouter()
  
  useEffect(() => {
    router.push(to)
  }, [router, to])
  
  return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="animate-spin h-10 w-10 border-4 border-purple-500 rounded-full border-t-transparent"></div>
      <p className="ml-4 text-gray-400">Looking for subscription...</p>
    </div>
  )
} 