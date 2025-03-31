import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { handleApiError, ApiError } from '@/lib/errors'
import { rateLimiter } from '@/lib/rateLimiter'
import { API, PDF_PROCESSING } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    await rateLimiter(request)

    const body = await request.json().catch(() => ({}))
    const { text } = body
    
    if (!text || typeof text !== 'string') {
      throw new ApiError(400, 'Invalid input: text is required and must be a string')
    }

    if (text.length === 0) {
      throw new ApiError(400, 'Invalid input: text cannot be empty')
    }

    const processedText = text.substring(0, PDF_PROCESSING.MAX_TEXT_LENGTH)

    const response = await fetch(
      `${API.GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
                  Please analyze this document and provide an elegant, narrative summary with the following format:

                  # Document Overview
                  Write a concise 2 sentence overview that captures the essence of the document. 
                  Focus on the main subject, purpose, and scope.

                  ## Main Insights
                  Provide 1 well-crafted paragraph, max 3 sentences, that explain the key arguments or findings from the document. 
                  Use clear, engaging language and focus on the most important information. 
                  Avoid bullet points and instead create a flowing narrative.

                  ## Critical Analysis
                  In 1 paragraph, max 3 sentences, analyze the document's methodology, approach, or perspective. 
                  Discuss any notable strengths, limitations, or unique aspects. 
                  Include relevant data or quotes if they enhance understanding.

                  ## Conclusion
                  Write a thoughtful concluding paragraph that summarizes the document's significance and main takeaways. 
                  What should the reader remember from this document? Max 2 senteces

                  Format the response with clear headings and well-structured paragraphs. 
                  Use professional, concise language throughout.

                  Document content: 
                  ${processedText}
              `
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      throw new ApiError(
        response.status, 
        errorData.error?.message || `Failed to analyze document: ${response.statusText}`,
        errorData
      )
    }

    const data = await response.json()
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new ApiError(500, 'Invalid response from AI service')
    }

    return NextResponse.json({ summary: data.candidates[0].content.parts[0].text })

  } catch (error) {
    return handleApiError(error)
  }
}