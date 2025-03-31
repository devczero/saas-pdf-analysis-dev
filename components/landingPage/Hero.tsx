"use client"

import { FileText, Search, Zap } from "lucide-react"
import ButtonGlowing from "./ButtonGlowing"

const rings = [
    { width: 300, opacity: 0.7 },
    { width: 500, opacity: 0.5 },
    { width: 700, opacity: 0.4 },
    { width: 900, opacity: 0.3 },
    { width: 1200, opacity: 0.2 },
]

const icons = [
    { 
        icon: FileText, 
        desc: "Analyze any PDF"
    },
    { 
        icon: Search, 
        desc: "Extract Key Insights"
    },
    { 
        icon: Zap, 
        desc: "Save Time"
    },
]

const Hero = () =>{
    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
            {/* Rings effect */}
            <div className="absolute inset-0 flex justify-center items-center z-0">
                    {rings.map((ring, index) => (
                        <div key={index} className={`
                            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            rounded-full border border-purple-300/20 shadow-[0_0_150px_inset] shadow-purple-200/10 
                          `}
                          style={{
                            width: `${ring.width}px`,
                            height: `${ring.width}px`,
                            opacity: ring.opacity
                          }}
                          >
                        </div>
                    ))}
            </div>

            {/* Content */}
            <div className="z-10 text-center px-4">
                <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                    PDF Analysis Tool
                </h1>

                <p className="text-lg md:text-xl text-white/70 mb-10 max-w-3xl mx-auto">
                    Extract insights from your documents instantly with our AI-powered analysis tool
                </p>

                <ButtonGlowing text="Get Started" href="/pricing" />
            </div>
            
            {/* Feature icons */}
            <div className="flex flex-wrap justify-center gap-8 mt-16 z-10 px-4">
                {icons.map((icon, index) => (
                    <div key={index} className="flex flex-col items-center max-w-[150px]">
                        <div className="w-12 h-12 rounded-full bg-purple-400/10 flex items-center justify-center mb-3">
                            <icon.icon className="text-purple-200 w-6 h-6" />
                        </div>
                        <p className="text-white/80 text-center text-sm">
                            {icon.desc}
                        </p>
                    </div>
                ))}
            </div>

        </div>
    )
}

export default Hero