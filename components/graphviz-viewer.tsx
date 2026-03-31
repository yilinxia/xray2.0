"use client"

import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react"
import { renderGraphvizSvg } from "@/lib/graphviz-layout"
import { generateGraphvizDot } from "@/lib/graphviz"
import type { ArgumentFramework, Semantics, SemanticsResult } from "@/lib/types"
import type { GraphvizConfig } from "./graphviz-config"
import type { ProvenanceResult } from "@/lib/clingo-semantics"

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
  selectedNode?: string | null
  onNodeClick?: (nodeId: string | null) => void
  onNodeContextMenu?: (nodeId: string, x: number, y: number) => void
  provenanceData?: ProvenanceResult | null
  provenanceTargetNode?: string | null
  provenanceType?: "potential" | "actual" | "primary" | null
}

export interface GraphvizViewerRef {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  snapshot: () => void
  getNodePositions: () => Record<string, { x: number; y: number }>
}

const GraphvizViewer = forwardRef<GraphvizViewerRef, GraphvizViewerProps>(({
  framework,
  semantics,
  selectedExtension,
  groundedResult,
  config,
  selectedNode,
  onNodeClick,
  onNodeContextMenu,
  provenanceData,
  provenanceTargetNode,
  provenanceType,
}, ref) => {
  const [svgContent, setSvgContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragMoved, setDragMoved] = useState(false)

  // Expose zoom methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => setScale((prev) => Math.min(prev * 1.2, 5)),
    zoomOut: () => setScale((prev) => Math.max(prev / 1.2, 0.1)),
    fit: () => {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    },
    getNodePositions: () => {
      const positions: Record<string, { x: number; y: number }> = {}
      if (!svgContainerRef.current) return positions
      
      const svg = svgContainerRef.current.querySelector('svg')
      if (!svg) return positions
      
      // Get the SVG's viewBox or dimensions for coordinate transformation
      const svgRect = svg.getBoundingClientRect()
      const viewBox = svg.getAttribute('viewBox')
      let svgWidth = svgRect.width
      let svgHeight = svgRect.height
      let viewBoxMinX = 0
      let viewBoxMinY = 0
      let viewBoxWidth = svgWidth
      let viewBoxHeight = svgHeight
      
      if (viewBox) {
        const parts = viewBox.split(/\s+|,/).map(Number)
        if (parts.length === 4) {
          [viewBoxMinX, viewBoxMinY, viewBoxWidth, viewBoxHeight] = parts
        }
      }
      
      // Extract node positions from SVG
      const nodes = svg.querySelectorAll('.node')
      nodes.forEach((node) => {
        const titleEl = node.querySelector('title')
        if (!titleEl) return
        
        const nodeId = titleEl.textContent?.trim()
        if (!nodeId) return
        
        // Get the ellipse or polygon element to find center
        const ellipse = node.querySelector('ellipse')
        const polygon = node.querySelector('polygon')
        
        let cx = 0, cy = 0
        
        if (ellipse) {
          cx = parseFloat(ellipse.getAttribute('cx') || '0')
          cy = parseFloat(ellipse.getAttribute('cy') || '0')
        } else if (polygon) {
          // For polygon, calculate center from points
          const points = polygon.getAttribute('points')
          if (points) {
            const coords = points.trim().split(/\s+/).map(p => {
              const [x, y] = p.split(',').map(Number)
              return { x, y }
            })
            if (coords.length > 0) {
              cx = coords.reduce((sum, c) => sum + c.x, 0) / coords.length
              cy = coords.reduce((sum, c) => sum + c.y, 0) / coords.length
            }
          }
        }
        
        // Transform from SVG coordinates to a normalized coordinate system
        // Graphviz SVG has Y increasing downward, we need to account for that
        positions[nodeId] = { x: cx, y: cy }
      })
      
      return positions
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
        // Convert selectedExtension to a partial SemanticsResult format for generateGraphvizDot
        const extensionAsResult = selectedExtension ? {
          accepted: selectedExtension.accepted,
          rejected: selectedExtension.rejected,
          undecided: selectedExtension.undecided,
          provenance: {},
        } as SemanticsResult : undefined

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
      setDragMoved(false)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  // Handle mouse move for pan
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setDragMoved(true)
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

  // Handle click on SVG - detect node clicks
  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    // Only process clicks, not drags
    if (dragMoved) return
    
    // Find if we clicked on a node
    let target = e.target as Element
    let nodeId: string | null = null
    
    // Traverse up the DOM to find a node group (g.node)
    while (target && target !== e.currentTarget) {
      if (target.classList?.contains('node')) {
        // Found a node group - extract the node ID from the title element
        const titleEl = target.querySelector('title')
        if (titleEl) {
          nodeId = titleEl.textContent?.trim() || null
        }
        break
      }
      target = target.parentElement as Element
    }
    
    if (onNodeClick) {
      if (nodeId) {
        // Toggle selection: if already selected, deselect
        onNodeClick(selectedNode === nodeId ? null : nodeId)
      } else {
        // Clicked on background - deselect
        onNodeClick(null)
      }
    }
  }, [dragMoved, onNodeClick, selectedNode])

  // Handle right-click on SVG - show context menu for nodes
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    
    // Find if we right-clicked on a node
    let target = e.target as Element
    let nodeId: string | null = null
    
    // Traverse up the DOM to find a node group (g.node)
    while (target && target !== e.currentTarget) {
      if (target.classList?.contains('node')) {
        // Found a node group - extract the node ID from the title element
        const titleEl = target.querySelector('title')
        if (titleEl) {
          nodeId = titleEl.textContent?.trim() || null
        }
        break
      }
      target = target.parentElement as Element
    }
    
    if (nodeId && onNodeContextMenu) {
      onNodeContextMenu(nodeId, e.clientX, e.clientY)
    }
  }, [onNodeContextMenu])

  // Add visual selection indicator to nodes
  useEffect(() => {
    if (!svgContainerRef.current) return
    
    const svg = svgContainerRef.current.querySelector('svg')
    if (!svg) return
    
    // Remove previous selection styling
    svg.querySelectorAll('.node').forEach((node) => {
      const ellipse = node.querySelector('ellipse')
      const polygon = node.querySelector('polygon')
      const shape = ellipse || polygon
      if (shape) {
        shape.removeAttribute('data-selected')
        shape.style.strokeWidth = ''
        shape.style.stroke = ''
      }
    })
    
    // Apply selection styling to selected node
    if (selectedNode) {
      const nodes = svg.querySelectorAll('.node')
      nodes.forEach((node) => {
        const titleEl = node.querySelector('title')
        if (titleEl && titleEl.textContent?.trim() === selectedNode) {
          const ellipse = node.querySelector('ellipse')
          const polygon = node.querySelector('polygon')
          const shape = ellipse || polygon
          if (shape) {
            shape.setAttribute('data-selected', 'true')
            shape.style.strokeWidth = '3'
            shape.style.stroke = '#3b82f6'
          }
        }
      })
    }
  }, [svgContent, selectedNode])

  // Apply provenance highlighting
  useEffect(() => {
    if (!svgContainerRef.current) return
    
    const svg = svgContainerRef.current.querySelector('svg')
    if (!svg) return
    
    // Reset all nodes - remove provenance styling and restore labels
    svg.querySelectorAll('.node').forEach((node) => {
      ;(node as SVGElement).style.opacity = ''
      const ellipse = node.querySelector('ellipse')
      const polygon = node.querySelector('polygon')
      const shape = ellipse || polygon
      if (shape) {
        shape.removeAttribute('data-provenance')
        shape.removeAttribute('data-provenance-target')
        ;(shape as SVGElement).style.fill = ''
        ;(shape as SVGElement).style.strokeWidth = ''
        ;(shape as SVGElement).style.stroke = ''
      }
      // Restore text visibility and color
      const texts = node.querySelectorAll('text')
      texts.forEach(t => {
        ;(t as SVGElement).style.display = ''
        ;(t as SVGElement).style.fill = ''
      })
    })
    
    // Reset all edges - remove provenance styling and restore labels
    svg.querySelectorAll('.edge').forEach((edge) => {
      ;(edge as SVGElement).style.opacity = ''
      edge.removeAttribute('data-provenance')
      const paths = edge.querySelectorAll('path')
      const polygons = edge.querySelectorAll('polygon')
      paths.forEach(p => {
        ;(p as SVGElement).style.stroke = ''
        ;(p as SVGElement).style.strokeDasharray = ''
      })
      polygons.forEach(p => {
        ;(p as SVGElement).style.stroke = ''
        ;(p as SVGElement).style.fill = ''
      })
      // Restore text visibility
      const texts = edge.querySelectorAll('text')
      texts.forEach(t => {
        ;(t as SVGElement).style.display = ''
      })
    })
    
    // If no provenance data, nothing more to do
    if (!provenanceData || !provenanceTargetNode) return
    
    const provenanceNodeSet = new Set(provenanceData.nodes)
    const provenanceEdgeSet = new Set(
      provenanceData.edges.map(e => `${e.from}->${e.to}`)
    )
    
    const isPotentialProvenance = provenanceType === "potential"
    
    // Style all nodes
    svg.querySelectorAll('.node').forEach((node) => {
      const titleEl = node.querySelector('title')
      const nodeId = titleEl?.textContent?.trim()
      
      const ellipse = node.querySelector('ellipse')
      const polygon = node.querySelector('polygon')
      const shape = ellipse || polygon
      const texts = node.querySelectorAll('text')
      
      // For potential provenance, strip length labels from ALL nodes
      if (isPotentialProvenance) {
        texts.forEach(t => {
          const textContent = t.textContent || ''
          // If text contains a dot followed by number or ∞, it's a length label - simplify it
          if (textContent.includes('.')) {
            const baseId = textContent.split('.')[0]
            t.textContent = baseId
          }
        })
      }
      
      if (nodeId && provenanceNodeSet.has(nodeId)) {
        // Provenance node - dark gray fill
        if (shape) {
          shape.setAttribute('data-provenance', 'true')
          ;(shape as SVGElement).style.fill = '#bebebe'
          
          // Target node gets thick border
          if (nodeId === provenanceTargetNode) {
            shape.setAttribute('data-provenance-target', 'true')
            ;(shape as SVGElement).style.strokeWidth = '5'
          }
        }
      } else {
        // Non-provenance node - white fill, gray border, gray text for potential provenance
        if (isPotentialProvenance) {
          if (shape) {
            ;(shape as SVGElement).style.fill = 'white'
            ;(shape as SVGElement).style.stroke = '#cccccc'
          }
          // Gray out the node label text
          texts.forEach(t => {
            ;(t as SVGElement).style.fill = '#cccccc'
          })
        }
      }
    })
    
    // Style all edges
    svg.querySelectorAll('.edge').forEach((edge) => {
      const titleEl = edge.querySelector('title')
      const edgeTitle = titleEl?.textContent?.trim()
      
      if (edgeTitle) {
        const paths = edge.querySelectorAll('path')
        const polygons = edge.querySelectorAll('polygon')
        const texts = edge.querySelectorAll('text')
        
        // For potential provenance, hide ALL edge labels
        if (isPotentialProvenance) {
          texts.forEach(t => {
            ;(t as SVGElement).style.display = 'none'
          })
        }
        
        // Parse edge title to get source and target: "from->to"
        const edgeParts = edgeTitle.split('->')
        const edgeSource = edgeParts.length === 2 ? edgeParts[0] : null
        const edgeTarget = edgeParts.length === 2 ? edgeParts[1] : null
        
        if (isPotentialProvenance) {
          // For potential provenance: edge is black only if BOTH nodes are in provenance
          const sourceInProvenance = edgeSource && provenanceNodeSet.has(edgeSource)
          const targetInProvenance = edgeTarget && provenanceNodeSet.has(edgeTarget)
          
          if (sourceInProvenance && targetInProvenance) {
            // Both nodes are in provenance - edge is black
            paths.forEach(p => {
              ;(p as SVGElement).style.stroke = '#000000'
              ;(p as SVGElement).style.strokeDasharray = 'none'
            })
            polygons.forEach(p => {
              ;(p as SVGElement).style.stroke = '#000000'
              ;(p as SVGElement).style.fill = '#000000'
            })
          } else {
            // At least one node is NOT in provenance - edge is gray
            paths.forEach(p => {
              ;(p as SVGElement).style.stroke = '#d3d3d3'
              ;(p as SVGElement).style.strokeDasharray = 'none'
            })
            polygons.forEach(p => {
              ;(p as SVGElement).style.stroke = '#d3d3d3'
              ;(p as SVGElement).style.fill = '#d3d3d3'
            })
          }
        } else if (provenanceEdgeSet.has(edgeTitle)) {
          // For actual/primary: provenance edge - make it black
          edge.setAttribute('data-provenance', 'true')
          paths.forEach(p => {
            ;(p as SVGElement).style.stroke = '#000000'
          })
          polygons.forEach(p => {
            ;(p as SVGElement).style.stroke = '#000000'
            ;(p as SVGElement).style.fill = '#000000'
          })
        } else {
          // For actual/primary: non-provenance edge - light gray
          paths.forEach(p => {
            ;(p as SVGElement).style.stroke = '#d3d3d3'
          })
          polygons.forEach(p => {
            ;(p as SVGElement).style.stroke = '#d3d3d3'
            ;(p as SVGElement).style.fill = '#d3d3d3'
          })
        }
      }
    })
  }, [svgContent, provenanceData, provenanceTargetNode, provenanceType])

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
      onClick={handleSvgClick}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={svgContainerRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      <style jsx global>{`
        .node {
          cursor: pointer;
        }
        .node:hover ellipse,
        .node:hover polygon {
          filter: brightness(0.95);
        }
      `}</style>
    </div>
  )
})

GraphvizViewer.displayName = "GraphvizViewer"

export default GraphvizViewer
