"use client"

import { useEffect, useState, useRef } from "react"
import { renderGraphvizSvg } from "@/lib/graphviz-layout"

interface TutorialGraphProps {
  dot: string
  caption?: string
  className?: string
  height?: number
}

export default function TutorialGraph({ dot, caption, className = "", height = 100 }: TutorialGraphProps) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    async function render() {
      try {
        const result = await renderGraphvizSvg(dot)
        if (mounted) {
          const processedSvg = result
            .replace(/width="[^"]*"/, 'width="100%"')
            .replace(/height="[^"]*"/, `height="${height}px"`)
            .replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid meet"')
          setSvg(processedSvg)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError("Failed to render graph")
          console.error("Graphviz render error:", err)
        }
      }
    }

    render()

    return () => {
      mounted = false
    }
  }, [dot, height])

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <figure className={`my-4 ${className}`}>
      <div 
        ref={containerRef}
        className="bg-white dark:bg-gray-900 rounded-lg border p-2 flex items-center justify-center"
        style={{ height: `${height + 16}px` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {caption && (
        <figcaption className="mt-1 text-xs text-center text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
