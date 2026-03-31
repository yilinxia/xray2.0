"use client"

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react"
import { renderGraphvizSvg } from "@/lib/graphviz-layout"
import { generateGraphvizDot } from "@/lib/graphviz"
import type { ArgumentFramework, Semantics, SemanticsResult } from "@/lib/types"
import type { GraphvizConfig } from "./graphviz-config"

interface GraphvizViewerProps {
  framework: ArgumentFramework
  semantics: Semantics | null
  selectedExtension?: {
    accepted: string[]
    rejected: string[]
    undecided: string[]
  } | null
  groundedResult: SemanticsResult | null
  config: GraphvizConfig
}

export interface GraphvizViewerRef {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  snapshot: () => void
}

const GraphvizViewer = forwardRef<GraphvizViewerRef, GraphvizViewerProps>(({
  framework,
  semantics,
  selectedExtension,
  groundedResult,
  config,
}, ref) => {
  const [svgContent, setSvgContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Expose zoom methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => setScale((prev) => Math.min(prev * 1.2, 5)),
    zoomOut: () => setScale((prev) => Math.max(prev / 1.2, 0.1)),
    fit: () => {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    },
    snapshot: () => {
      if (!svgContent) return
      
      // Create a canvas to convert SVG to PNG
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Create an image from the SVG
      const img = new Image()
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        // Set canvas size to match SVG (with scale for better quality)
        const scaleFactor = 2
        canvas.width = img.width * scaleFactor
        canvas.height = img.height * scaleFactor
        
        // Fill with white background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Draw the image
        ctx.scale(scaleFactor, scaleFactor)
        ctx.drawImage(img, 0, 0)
        
        // Convert to PNG and download
        canvas.toBlob((blob) => {
          if (!blob) return
          const downloadUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = downloadUrl
          a.download = 'graph-snapshot.png'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(downloadUrl)
        }, 'image/png')
        
        URL.revokeObjectURL(url)
      }

      img.src = url
    },
  }))

  // Generate and render SVG when inputs change
  useEffect(() => {
    const renderSvg = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Convert selectedExtension to SemanticsResult format for generateGraphvizDot
        const extensionAsResult: SemanticsResult | undefined = selectedExtension ? {
          accepted: selectedExtension.accepted,
          rejected: selectedExtension.rejected,
          undecided: selectedExtension.undecided,
          extensions: [selectedExtension],
          provenance: {},
        } : undefined

        // Generate DOT string
        const dotString = generateGraphvizDot(
          framework,
          semantics,
          config,
          extensionAsResult,
          groundedResult || undefined
        )

        // Render to SVG using Graphviz WASM
        let svg = await renderGraphvizSvg(dotString)
        
        // Modify SVG to be responsive - remove fixed width/height and add viewBox if not present
        // This allows the SVG to scale properly within its container
        svg = svg.replace(/<svg\s+/, '<svg style="max-width: 100%; max-height: 100%;" ')
        
        setSvgContent(svg)
      } catch (err) {
        console.error("Error rendering Graphviz:", err)
        setError(err instanceof Error ? err.message : "Failed to render graph")
      } finally {
        setIsLoading(false)
      }
    }

    renderSvg()
  }, [framework, semantics, selectedExtension, groundedResult, config])

  // Handle mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 5))
  }

  // Handle mouse down for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  // Handle mouse move for pan
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Rendering graph...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-white cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
})

GraphvizViewer.displayName = "GraphvizViewer"

export default GraphvizViewer
