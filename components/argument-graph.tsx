"use client"

import { useRef, useEffect, useState } from "react"
import cytoscape from "cytoscape"
import { Trash2, ExternalLink, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { computeSemantics } from "@/lib/argumentation"
import { generateGraphvizDot } from "@/lib/graphviz"
import NodeEditor from "./node-editor"
import GraphvizConfig, { type GraphvizConfig as GraphvizConfigType } from "./graphviz-config"
import type { ArgumentFramework, Semantics, Attack, ProvenanceInfo, Argument, ProvenanceType } from "@/lib/types"

// Define available layout options
export const layoutOptions = [
  { value: "circle", label: "Circle" },
  { value: "grid", label: "Grid" },
  { value: "breadthfirst", label: "Tree" },
  { value: "concentric", label: "Concentric" },
  { value: "cose", label: "Force-Directed" },
  { value: "random", label: "Random" },
]

interface ArgumentGraphProps {
  framework: ArgumentFramework
  semantics: Semantics
  onFrameworkChange: (framework: ArgumentFramework) => void
}

export default function ArgumentGraph({ framework, semantics, onFrameworkChange }: ArgumentGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [currentLayout, setCurrentLayout] = useState("circle")
  const [selectedEdge, setSelectedEdge] = useState<Attack | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [semanticsResult, setSemanticResult] = useState<any>(null)
  const [provenanceType, setProvenanceType] = useState<ProvenanceType>("actual")

  // Node editor state
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false)
  const [nodeToEdit, setNodeToEdit] = useState<Argument | null>(null)

  // Graphviz configuration
  const [graphvizConfig, setGraphvizConfig] = useState<GraphvizConfigType>({
    direction: "LR",
    acceptedColor: "#10b981", // Green
    rejectedColor: "#ef4444", // Red
    undecidedColor: "#f59e0b", // Amber
    allowBackwardArrows: true,
    rankSameGroups: [],
  })

  // Apply the selected layout to the graph
  const applyLayout = (layoutName: string) => {
    if (!cyRef.current) return

    // Define layout options based on the selected layout
    let layoutOptions: any = { name: layoutName }

    // Add specific options for certain layouts
    if (layoutName === "breadthfirst") {
      layoutOptions = {
        ...layoutOptions,
        directed: true,
        padding: 30,
        spacingFactor: 1.5,
        animate: true,
      }
    } else if (layoutName === "cose") {
      layoutOptions = {
        ...layoutOptions,
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        animate: true,
        animationDuration: 500,
      }
    } else if (layoutName === "concentric") {
      layoutOptions = {
        ...layoutOptions,
        minNodeSpacing: 50,
        animate: true,
      }
    }

    // Run the layout
    cyRef.current.layout(layoutOptions).run()
  }

  // Update tooltip position when the graph is panned or zoomed
  const updateTooltipPosition = () => {
    if (!cyRef.current || !hoveredNode) return

    const node = cyRef.current.getElementById(hoveredNode)
    if (node.length === 0) return

    const position = node.renderedPosition()
    const nodeHeight = Number.parseFloat(node.style("height"))

    // Position the tooltip above the node
    setTooltipPosition({
      x: position.x,
      y: position.y - nodeHeight / 2 - 10,
    })
  }

  // Delete the selected edge
  const handleDeleteEdge = () => {
    if (!selectedEdge) return

    // Create a new framework with the edge removed
    const newFramework: ArgumentFramework = {
      ...framework,
      attacks: framework.attacks.filter(
        (attack) => !(attack.from === selectedEdge.from && attack.to === selectedEdge.to),
      ),
    }

    // Update the framework
    onFrameworkChange(newFramework)

    // Clear the selected edge
    setSelectedEdge(null)
  }

  // Get the argument object for a node ID
  const getArgument = (nodeId: string): Argument | null => {
    return framework.args.find((arg) => arg.id === nodeId) || null
  }

  // Get the provenance info for a node ID
  const getProvenanceInfo = (nodeId: string): ProvenanceInfo | null => {
    if (!semanticsResult || !semanticsResult.provenance) return null
    return semanticsResult.provenance[nodeId] || null
  }

  // Highlight nodes based on the selected provenance type
  const highlightProvenanceNodes = (nodeId: string) => {
    if (!cyRef.current || !semanticsResult) return

    // Reset all nodes and edges to default style
    cyRef.current.elements().removeClass("attacker defender highlighted-edge")

    const provenance = semanticsResult.provenance[nodeId]
    if (!provenance) return

    let nodesToHighlight: string[] = []

    // Determine which nodes to highlight based on provenance type
    switch (provenanceType) {
      case "potential":
        nodesToHighlight = provenance.potentialProvenance || provenance.attackers || []
        break
      case "primary":
        nodesToHighlight = provenance.primaryProvenance || provenance.defenders || []
        break
      case "actual":
        // For actual provenance, highlight both attackers and defenders
        nodesToHighlight = [...(provenance.attackers || []), ...(provenance.defenders || [])]
        break
    }

    // Highlight the nodes
    nodesToHighlight.forEach((id) => {
      const node = cyRef.current?.getElementById(id)
      if (node) {
        // Determine if this is an attacker or defender
        const isAttacker = provenance.attackers?.includes(id)
        const isDefender = provenance.defenders?.includes(id)

        if (isAttacker) {
          node.addClass("attacker")
        } else if (isDefender) {
          node.addClass("defender")
        }

        // Highlight edges
        if (isAttacker) {
          // Edge from attacker to selected node
          const edge = cyRef.current?.getElementById(`${id}-${nodeId}`)
          if (edge) {
            edge.addClass("highlighted-edge")
          }
        } else if (isDefender) {
          // Find edges from defender to attackers
          provenance.attackers?.forEach((attackerId) => {
            const edge = cyRef.current?.getElementById(`${id}-${attackerId}`)
            if (edge) {
              edge.addClass("highlighted-edge")
            }
          })
        }
      }
    })
  }

  // Clear highlighting
  const clearHighlighting = () => {
    if (!cyRef.current) return
    cyRef.current.elements().removeClass("attacker defender highlighted-edge")
  }

  // Handle node edit
  const handleNodeEdit = (nodeId: string) => {
    const node = getArgument(nodeId)
    if (node) {
      setNodeToEdit(node)
      setIsNodeEditorOpen(true)
    }
  }

  // Save node edits
  const handleSaveNodeEdit = (updatedNode: Argument) => {
    // Create a new framework with the updated node
    const newFramework: ArgumentFramework = {
      ...framework,
      args: framework.args.map((arg) => (arg.id === updatedNode.id ? updatedNode : arg)),
    }

    // Update the framework
    onFrameworkChange(newFramework)
  }

  // Download graph as Graphviz .gv file
  const downloadGraphvizFile = () => {
    if (!framework) return

    const dot = generateGraphvizDot(framework, semantics, graphvizConfig)
    const blob = new Blob([dot], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${framework.name || "argumentation-framework"}.gv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Update Cytoscape node colors based on Graphviz config
  const updateNodeColors = () => {
    if (!cyRef.current || !semanticsResult) return

    cyRef.current.nodes().forEach((node) => {
      const nodeId = node.id()

      // Remove existing classes
      node.removeClass("accepted rejected undecided")

      // Apply new colors based on semantics result
      if (semanticsResult.accepted.includes(nodeId)) {
        node.style("background-color", graphvizConfig.acceptedColor)
        node.addClass("accepted")
      } else if (semanticsResult.rejected.includes(nodeId)) {
        node.style("background-color", graphvizConfig.rejectedColor)
        node.addClass("rejected")
      } else {
        node.style("background-color", graphvizConfig.undecidedColor)
        node.addClass("undecided")
      }
    })
  }

  // Initialize and update the graph
  useEffect(() => {
    if (!containerRef.current || !framework) return

    // Compute semantics result
    const result = computeSemantics(framework, semantics)
    setSemanticResult(result)

    // Create the graph if it doesn't exist
    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "#f3f4f6",
              "border-color": "#d1d5db",
              "border-width": 1,
              label: "data(id)",
              color: "#1f2937",
              "text-valign": "center",
              "text-halign": "center",
              "font-size": "12px",
              width: 40,
              height: 40,
              shape: "ellipse",
            },
          },
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "#9ca3af",
              "target-arrow-color": "#9ca3af",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
            },
          },
          {
            selector: ".accepted",
            style: {
              "background-color": graphvizConfig.acceptedColor,
              "border-color": "#059669",
            },
          },
          {
            selector: ".rejected",
            style: {
              "background-color": graphvizConfig.rejectedColor,
              "border-color": "#dc2626",
            },
          },
          {
            selector: ".undecided",
            style: {
              "background-color": graphvizConfig.undecidedColor,
              "border-color": "#d97706",
            },
          },
          {
            selector: ".hovered",
            style: {
              "border-width": 3,
              "border-color": "#3b82f6",
            },
          },
          {
            selector: ".selected",
            style: {
              "line-color": "#3b82f6",
              "target-arrow-color": "#3b82f6",
              width: 3,
            },
          },
          {
            selector: ".attacker",
            style: {
              "border-width": 3,
              "border-color": "#ef4444",
              "border-style": "dashed",
            },
          },
          {
            selector: ".defender",
            style: {
              "border-width": 3,
              "border-color": "#10b981",
              "border-style": "dashed",
            },
          },
          {
            selector: ".highlighted-edge",
            style: {
              "line-color": "#6366f1",
              "target-arrow-color": "#6366f1",
              "line-style": "dashed",
              width: 3,
            },
          },
        ],
        layout: {
          name: currentLayout,
        },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
      })

      // Add event listeners for nodes
      cyRef.current.on("mouseover", "node", (event) => {
        const node = event.target
        node.addClass("hovered")
        setHoveredNode(node.id())

        const position = node.renderedPosition()
        const nodeHeight = Number.parseFloat(node.style("height"))

        // Position the tooltip above the node
        setTooltipPosition({
          x: position.x,
          y: position.y - nodeHeight / 2 - 10,
        })
      })

      cyRef.current.on("mouseout", "node", (event) => {
        const node = event.target
        node.removeClass("hovered")
        setHoveredNode(null)
      })

      cyRef.current.on("tap", "node", (event) => {
        const node = event.target
        const nodeId = node.id()

        // If the node is already selected, deselect it
        if (selectedNode === nodeId) {
          setSelectedNode(null)
          clearHighlighting()
        } else {
          // Otherwise, select it and highlight related nodes
          setSelectedNode(nodeId)
          highlightProvenanceNodes(nodeId)
        }
      })

      // Add double-click event for node editing
      cyRef.current.on("dbltap", "node", (event) => {
        const node = event.target
        const nodeId = node.id()
        handleNodeEdit(nodeId)
      })

      // Add event listeners for edges
      cyRef.current.on("tap", "edge", (event) => {
        // Clear previous selection
        cyRef.current?.edges().removeClass("selected")

        // Select the clicked edge
        const edge = event.target
        edge.addClass("selected")

        // Get the source and target nodes
        const sourceId = edge.source().id()
        const targetId = edge.target().id()

        // Set the selected edge
        setSelectedEdge({ from: sourceId, to: targetId })

        // Clear node selection
        setSelectedNode(null)
        clearHighlighting()
      })

      // Clear selection when clicking on the background
      cyRef.current.on("tap", (event) => {
        if (event.target === cyRef.current) {
          cyRef.current.edges().removeClass("selected")
          setSelectedEdge(null)
          setSelectedNode(null)
          clearHighlighting()
        }
      })

      // Update tooltip position when the graph is panned or zoomed
      cyRef.current.on("pan zoom", () => {
        updateTooltipPosition()
      })
    }

    // Update the graph with the current framework
    const cy = cyRef.current
    cy.elements().remove()

    // Add nodes (arguments)
    framework.args.forEach((arg) => {
      cy.add({
        group: "nodes",
        data: {
          id: arg.id,
          annotation: arg.annotation || `Argument ${arg.id}`,
          url: arg.url || "",
        },
      })
    })

    // Add edges (attacks)
    framework.attacks.forEach((attack) => {
      // Skip backward arrows if not allowed by Graphviz config
      if (!graphvizConfig.allowBackwardArrows) {
        const fromIndex = framework.args.findIndex((arg) => arg.id === attack.from)
        const toIndex = framework.args.findIndex((arg) => arg.id === attack.to)
        if (fromIndex > toIndex) {
          return
        }
      }

      cy.add({
        group: "edges",
        data: {
          id: `${attack.from}-${attack.to}`,
          source: attack.from,
          target: attack.to,
          annotation: attack.annotation || "",
        },
      })
    })

    // Apply layout
    applyLayout(currentLayout)

    // Apply semantics coloring
    if (semantics) {
      const semanticsResult = computeSemantics(framework, semantics)

      cy.nodes().forEach((node) => {
        const nodeId = node.id()
        if (semanticsResult.accepted.includes(nodeId)) {
          node.style("background-color", graphvizConfig.acceptedColor)
          node.addClass("accepted")
        } else if (semanticsResult.rejected.includes(nodeId)) {
          node.style("background-color", graphvizConfig.rejectedColor)
          node.addClass("rejected")
        } else {
          node.style("background-color", graphvizConfig.undecidedColor)
          node.addClass("undecided")
        }
      })
    }

    // Fit the graph to the viewport
    cy.fit()

    // Clear selected edge when framework changes
    setSelectedEdge(null)
    setSelectedNode(null)
    clearHighlighting()

    // Cleanup
    return () => {
      // No need to destroy cytoscape instance, we'll reuse it
    }
  }, [framework, semantics, currentLayout, graphvizConfig.allowBackwardArrows])

  // Update node colors when graphviz config changes
  useEffect(() => {
    updateNodeColors()
  }, [graphvizConfig.acceptedColor, graphvizConfig.rejectedColor, graphvizConfig.undecidedColor])

  // Update highlighting when provenance type changes
  useEffect(() => {
    if (selectedNode) {
      highlightProvenanceNodes(selectedNode)
    }
  }, [provenanceType, selectedNode])

  // Handle layout change
  const handleLayoutChange = (layoutName: string) => {
    setCurrentLayout(layoutName)
  }

  // Get the argument for the hovered node
  const hoveredArgument = hoveredNode ? getArgument(hoveredNode) : null

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex justify-between mb-4">
        <div>
          {selectedEdge && (
            <div className="flex items-center space-x-2">
              <span className="text-sm">
                Selected attack: <strong>{selectedEdge.from}</strong> → <strong>{selectedEdge.to}</strong>
              </span>
              <Button variant="destructive" size="sm" onClick={handleDeleteEdge} className="flex items-center">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
          {selectedNode && (
            <div className="flex items-center space-x-2">
              <span className="text-sm">
                Selected argument: <strong>{selectedNode}</strong>
              </span>
              <Select value={provenanceType} onValueChange={(value) => setProvenanceType(value as ProvenanceType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Provenance Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="potential">Potential Provenance</SelectItem>
                  <SelectItem value="primary">Primary Provenance</SelectItem>
                  <SelectItem value="actual">Actual Provenance</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedNode(null)
                  clearHighlighting()
                }}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNodeEdit(selectedNode)}
                className="flex items-center"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <GraphvizConfig
            framework={framework}
            semantics={semantics}
            config={graphvizConfig}
            onConfigChange={setGraphvizConfig}
            onDownloadGv={downloadGraphvizFile}
          />
          <div className="w-48">
            <Select value={currentLayout} onValueChange={handleLayoutChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Layout" />
              </SelectTrigger>
              <SelectContent>
                {layoutOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full" />

      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-white p-3 rounded-md shadow-lg border">
            <div className="max-w-xs">
              <h4 className="font-bold">{hoveredNode}</h4>
              <p className="text-sm text-muted-foreground">
                {hoveredArgument?.annotation || `Argument ${hoveredNode}`}
              </p>
              {hoveredArgument?.url && (
                <div className="flex items-center mt-1 text-xs text-blue-500">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <a
                    href={hoveredArgument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View more information
                  </a>
                </div>
              )}
              <p className="text-xs mt-1">Click to see how this value is calculated</p>
              <p className="text-xs">Double-click to edit</p>
            </div>
          </div>
        </div>
      )}

      <NodeEditor
        isOpen={isNodeEditorOpen}
        onClose={() => setIsNodeEditorOpen(false)}
        onSave={handleSaveNodeEdit}
        node={nodeToEdit}
      />
    </div>
  )
}
