'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  CheckCircle, 
  FileText, 
  AlertCircle
} from 'lucide-react'
import { extractTextFromPDF } from '@/lib/pdfUtils'

export default function DashboardContent() {

    const router = useRouter()
    const searchParams = useSearchParams()

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [summary, setSummary] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

    useEffect(() => {
        const isPaymentSuccess = searchParams?.get('payment') === 'success';
                                
        if (isPaymentSuccess) {
            setShowPaymentSuccess(true)
            router.replace('/dashboard')
            
            const timer = setTimeout(() => {
            setShowPaymentSuccess(false)
            }, 5000)
            
            return () => clearTimeout(timer)
        }
    }, [searchParams, router])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError('')
        
        if (!e.target.files?.[0]) return
        
        setSelectedFile(e.target.files[0])
    }

    //TODO: handleAnalyze function
    const handleAnalyze = useCallback(async () => {
        if (!selectedFile) {
            setError('Please select a file before analyzing.')
            return
        }

        setIsLoading(true)
        setError('')
        setSummary('')

        try {
            const text = await extractTextFromPDF(selectedFile);

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ text: text.substring(0, 10000)})
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            setSummary(data.summary || 'No summary was generated.')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to analyze PDF.')
        } finally {
            setIsLoading(false)
        }
    }, [selectedFile])


    const formatSummaryContent = (text: string) => {
        const paragraphs = text.split('\n').filter(p => p.trim() !== '')
        
        return paragraphs.map((paragraph, index) => {
          if (paragraph.startsWith('# ')) {
            return (
              <h2 key={index} className="text-2xl font-bold mt-6 mb-4 bg-gradient-to-r from-purple-400 to-pink-500 
                                            bg-clip-text text-transparent">
                {paragraph.replace(/^# /, '')}
              </h2>
            )
          }
          
          if (paragraph.startsWith('## ')) {
            return (
              <h3 key={index} className="text-xl font-semibold mt-6 mb-3 text-purple-300 border-b border-purple-500/20 pb-2">
                {paragraph.replace(/^## /, '')}
              </h3>
            )
          }
          
          return (
            <p key={index} className="mb-4 text-gray-300 leading-relaxed hover:text-white transition-colors 
                                        first-letter:text-lg first-letter:font-medium">
              {paragraph}
            </p>
          )
        })
    }
    

    return (
        <div className='min-h-[300vh] space-y-10 mt-24 max-w-4xl mx-auto'>
            {showPaymentSuccess && (
                <div className='bg-green-500/10 max-w-xl mx-auto my-8 border border-green-500/20 rounded-xl p-4 text-green-400'>
                    <div className='flex items-center justify-center'>
                        <CheckCircle className='h-5 w-5 mr-4' />
                        <p>Payment successfull! Your subscription is now active!</p>
                    </div>
                </div>
            )}

            {/* File upload and analysis section */}
            <div className='p-10 space-y-8 rounded-2xl border border-purple-300/10 bg-black/30 shadow-[0_4px_20px_-10px] shadow-purple-200/30'>
                
                {/* File input for PDF selection */}
                <div className="relative">
                        <div className="my-2 ml-2 flex items-center text-xs text-gray-500">
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            <span>Supported format: PDF</span>
                        </div>
                        <div className="border border-gray-700 rounded-xl p-1 bg-black/40 hover:border-purple-200/20 transition-colors">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf"
                                className="block w-full text-gray-300 file:mr-4 file:py-3 file:px-6 
                                        file:rounded-lg file:border-0 file:text-sm file:font-medium
                                        file:bg-purple-200/20 file:text-purple-200 hover:file:bg-purple-200/20 transition-all
                                        focus:outline-none cursor-pointer"
                            />
                        </div>
                </div>

                {/* Analyze button - disabled when no file selected or during loading */}
                <button
                    onClick={handleAnalyze}
                    disabled={!selectedFile || isLoading}
                    className="group relative inline-flex items-center justify-center w-full gap-2 rounded-xl bg-black px-4 py-4
                                text-white transition-all hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#FF1E56] via-[#FF00FF] to-[#00FFFF]
                                opacity-70 blur-sm transition-all group-hover:opacity-100 disabled:opacity-40" />
                    <span className="absolute inset-0.5 rounded-xl bg-black/50" />
                    <span className="relative font-medium">
                        {isLoading ? 'Processing...' : 'Analyze Document'}
                    </span>
                </button>
            </div>

            {/* Error message - only shown when there's an error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
                        <div>
                            <p className="font-medium mb-1">Error analyzing document</p>
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary results - only shown when there's a summary */}
            {summary && (
                <div className="bg-black/20 shadow-[0_4px_20px_-10px] shadow-purple-200/30 rounded-2xl p-8 border border-[#2A2A35]">
                    {/* Summary header */}
                    <div className="flex items-center mb-6">
                        <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                            <FileText className="h-6 w-6 text-purple-400" />
                        </div>
                    </div>
                    
                    {/* Formatted summary content */}
                    <div className="max-w-none px-6 py-5 rounded-xl bg-[#0f0f13] border border-[#2A2A35]">
                        {formatSummaryContent(summary)}
                    </div>
                </div>
            )}

            
        </div>
    )
}