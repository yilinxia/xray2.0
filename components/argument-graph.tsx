"use client"

import { useRef, useEffect, useState } from "react"
import cytoscape from "cytoscape"
import cytoscapeDagre from "cytoscape-dagre"
cytoscape.use(cytoscapeDagre);
import { Trash2, ExternalLink, Edit, ZoomIn, ZoomOut, Maximize2, RefreshCw, Dice5 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { computeSemantics } from "@/lib/argumentation"
import { generateGraphvizDot } from "@/lib/graphviz"
import NodeEditor from "./node-editor"
import EdgeEditor from "./edge-editor"
import GraphvizConfig, { type GraphvizConfig as GraphvizConfigType } from "./graphviz-config"
import type { ArgumentFramework, Semantics, Attack, ProvenanceInfo, Argument, ProvenanceType } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Icon } from '@iconify/react';

// Define available layout options
export const layoutOptions = [
  { value: "circle", label: "Circle" },
  { value: "grid", label: "Grid" },
  { value: "breadthfirst", label: "Tree" },
  { value: "concentric", label: "Concentric" },
  { value: "cose", label: "Force-Directed" },
  { value: "random", label: "Random" },
  { value: "dagre", label: "Layered (Dagre)" }, // Added dagre
]

interface ArgumentGraphProps {
  framework: ArgumentFramework
  initialFramework: ArgumentFramework | null
  semantics: Semantics
  onFrameworkChange: (framework: ArgumentFramework) => void
}

export default function ArgumentGraph({ framework, initialFramework, semantics, onFrameworkChange }: ArgumentGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [currentLayout, setCurrentLayout] = useState("dagre")
  const [selectedEdge, setSelectedEdge] = useState<Attack | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [semanticsResult, setSemanticResult] = useState<any>(null)
  const [provenanceType, setProvenanceType] = useState<ProvenanceType>("actual")

  // Node editor state
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false)
  const [nodeToEdit, setNodeToEdit] = useState<Argument | null>(null)

  // Edge editor state
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false)
  const [edgeToEdit, setEdgeToEdit] = useState<Attack | null>(null)

  // Graphviz configuration
  const [graphvizConfig, setGraphvizConfig] = useState<GraphvizConfigType>({
    direction: "LR",
    acceptedColor: "#40cfff", // Blue
    rejectedColor: "#ffb763", // Orange
    undecidedColor: "#fefe62", // Yellow
    allowBackwardArrows: true,
    rankSameGroups: [],
  })

  // Provenance checkboxes state
  const [provenanceChecks, setProvenanceChecks] = useState({
    potential: false,
    primary: false,
    actual: false,
  })

  // Provenance radio state
  const [provenanceRadio, setProvenanceRadio] = useState<ProvenanceType | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    nodeId: string | null
  }>({ open: false, x: 0, y: 0, nodeId: null })

  // Edge context menu state
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    edgeId: string | null
  }>({ open: false, x: 0, y: 0, edgeId: null })

  // Update initialFramework when framework changes from outside (prop)
  useEffect(() => {
    if (initialFramework === null) {
      // This useEffect is now redundant as initialFramework is passed as a prop
      // Keeping it for now to avoid breaking existing logic, but it will never run
      // with the new_code.
      // setInitialFramework(framework) 
    }
  }, [framework])

  // Reset handler
  const handleResetGraph = () => {
    if (initialFramework) {
      onFrameworkChange(initialFramework)
      setSelectedNode(null)
      setSelectedEdge(null)
      clearHighlighting()
    }
  }

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
        concentric: function (node: cytoscape.NodeSingular) {
          // Try to extract the number after the dot in the label, e.g., 'A.2' => 2, 'M.∞' => 1000
          const label = node.data('label') || node.data('id');
          const match = label && label.match(/\.(\d+|∞)/);
          if (match) {
            return match[1] === '∞' ? 1000 : parseInt(match[1], 10);
          }
          return 0;
        },
        levelWidth: function (nodes: cytoscape.Collection) { return 1; },
      }
    } else if (layoutName === "dagre") {
      layoutOptions = {
        ...layoutOptions,
        name: "dagre",
        rankDir: "TB", // Top to Bottom
        nodeSep: 50,
        rankSep: 100,
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
  const highlightProvenanceNodes = (nodeId: string, provenanceType: ProvenanceType = "actual") => {
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
      const cyInstance = cyRef.current
      if (!cyInstance) return
      const node = cyInstance.getElementById(id)
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
          const edge = cyInstance.getElementById(`${id}-${nodeId}`)
          if (edge) {
            edge.addClass("highlighted-edge")
          }
        } else if (isDefender) {
          // Find edges from defender to attackers
          provenance.attackers?.forEach((attackerId: string) => {
            const edge = cyInstance.getElementById(`${id}-${attackerId}`)
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

  // Save edge edits
  const handleSaveEdgeEdit = (updatedEdge: Attack) => {
    // Create a new framework with the updated edge
    const newFramework: ArgumentFramework = {
      ...framework,
      attacks: framework.attacks.map((attack) =>
        attack.from === updatedEdge.from && attack.to === updatedEdge.to
          ? updatedEdge
          : attack
      ),
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
      const nodeData = node.data()
      const nodeValue = nodeData.value // Check if node has a manual value set

      // Remove existing classes
      node.removeClass("accepted rejected undecided")

      // Only apply colors if node has a manual value set
      if (nodeValue === "accepted") {
        node.style("background-color", graphvizConfig.acceptedColor)
        node.addClass("accepted")
      } else if (nodeValue === "defeated") {
        node.style("background-color", graphvizConfig.rejectedColor)
        node.addClass("rejected")
      } else if (nodeValue === "undecided") {
        node.style("background-color", graphvizConfig.undecidedColor)
        node.addClass("undecided")
      } else {
        // No manual value set - use default gray color
        node.style("background-color", "#ffffff")
        node.removeClass("accepted rejected undecided")
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
        minZoom: 0.1,
        maxZoom: 3,
        wheelSensitivity: 0.1,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "#ffffff",
              "border-color": "#000000",
              "border-width": 1,
              label: "data(id)",
              color: "#1f2937",
              "text-valign": "center",
              "text-halign": "center",
              "font-size": "14px",
              width: 60,
              height: 60,
              shape: "ellipse",
            },
          },
          {
            selector: "edge",
            style: {
              width: 1,
              "line-color": "#000000",
              "target-arrow-color": "#000000",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
            },
          },
          {
            selector: ".accepted",
            style: {
              "background-color": graphvizConfig.acceptedColor,
              "border-color": "#000000",
              "border-width": 1,
            },
          },
          {
            selector: ".rejected",
            style: {
              "background-color": graphvizConfig.rejectedColor,
              "border-color": "#000000",
              "border-width": 1,
            },
          },
          {
            selector: ".undecided",
            style: {
              "background-color": graphvizConfig.undecidedColor,
              "border-color": "#000000",
              "border-width": 1,
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

        // Close context menu if open
        if (contextMenu.open) {
          setContextMenu(c => ({ ...c, open: false }))
        }
        if (edgeContextMenu.open) {
          setEdgeContextMenu(c => ({ ...c, open: false }))
        }

        // If the node is already selected, deselect it
        if (selectedNode === nodeId) {
          setSelectedNode(null)
          clearHighlighting()
        } else {
          // Otherwise, select it and highlight related nodes
          setSelectedNode(nodeId)
          setSelectedEdge(null) // Clear edge selection
          highlightProvenanceNodes(nodeId)
        }
      })

      // Add event listeners for edges
      cyRef.current.on("tap", "edge", (event) => {
        // Close context menu if open
        if (contextMenu.open) {
          setContextMenu(c => ({ ...c, open: false }))
        }
        if (edgeContextMenu.open) {
          setEdgeContextMenu(c => ({ ...c, open: false }))
        }

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
        setSelectedNode(null) // Clear node selection
        clearHighlighting()
      })

      // Clear selection when clicking on the background
      cyRef.current.on("tap", (event) => {
        if (cyRef.current && event.target === cyRef.current) {
          // Close context menu if open
          if (contextMenu.open) {
            setContextMenu(c => ({ ...c, open: false }))
          }
          if (edgeContextMenu.open) {
            setEdgeContextMenu(c => ({ ...c, open: false }))
          }

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
          label: arg.annotation || arg.id,
          value: arg.value || null,
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

    // Apply node coloring (respects manual values and semantics)
    updateNodeColors()

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

  // Update node colors when framework changes (to apply manual values)
  useEffect(() => {
    updateNodeColors()
  }, [framework])

  // Update highlighting when provenance radio or node selection changes
  useEffect(() => {
    if (selectedNode && provenanceRadio) {
      clearHighlighting()
      highlightProvenanceNodes(selectedNode, provenanceRadio)
    } else {
      clearHighlighting()
    }
  }, [provenanceRadio, selectedNode])

  // Open context menu on right-click (cxttap) on node
  useEffect(() => {
    if (!cyRef.current) return
    const cy = cyRef.current
    const handler = (event: any) => {
      event.preventDefault()
      const nodeId = event.target.id()
      const { x, y } = event.renderedPosition || event.position || { x: 0, y: 0 }
      // Convert Cytoscape rendered position to page coordinates
      const rect = containerRef.current?.getBoundingClientRect()
      setContextMenu({
        open: true,
        x: (rect?.left || 0) + x,
        y: (rect?.top || 0) + y,
        nodeId,
      })
    }
    cy.on("cxttap", "node", handler)
    return () => {
      cy.off("cxttap", "node", handler)
    }
  }, [cyRef.current])

  // Open context menu on right-click (cxttap) on edge
  useEffect(() => {
    if (!cyRef.current) return
    const cy = cyRef.current
    const handler = (event: any) => {
      event.preventDefault()
      const edgeId = event.target.id()
      const { x, y } = event.renderedPosition || event.position || { x: 0, y: 0 }
      // Convert Cytoscape rendered position to page coordinates
      const rect = containerRef.current?.getBoundingClientRect()
      setEdgeContextMenu({
        open: true,
        x: (rect?.left || 0) + x,
        y: (rect?.top || 0) + y,
        edgeId,
      })
    }
    cy.on("cxttap", "edge", handler)
    return () => {
      cy.off("cxttap", "edge", handler)
    }
  }, [cyRef.current])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu.open) {
        setContextMenu(c => ({ ...c, open: false }))
      }
      if (edgeContextMenu.open) {
        setEdgeContextMenu(c => ({ ...c, open: false }))
      }
    }

    if (contextMenu.open || edgeContextMenu.open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [contextMenu.open, edgeContextMenu.open])

  // Close context menu on any mouse interaction with the graph container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseInteraction = () => {
      if (contextMenu.open) {
        setContextMenu(c => ({ ...c, open: false }))
      }
      if (edgeContextMenu.open) {
        setEdgeContextMenu(c => ({ ...c, open: false }))
      }
    }

    container.addEventListener('mousedown', handleMouseInteraction)
    container.addEventListener('mouseup', handleMouseInteraction)
    container.addEventListener('click', handleMouseInteraction)

    return () => {
      container.removeEventListener('mousedown', handleMouseInteraction)
      container.removeEventListener('mouseup', handleMouseInteraction)
      container.removeEventListener('click', handleMouseInteraction)
    }
  }, [contextMenu.open, edgeContextMenu.open])

  // Context menu actions
  const handleContextProvenance = (type: ProvenanceType) => {
    setSelectedNode(contextMenu.nodeId)
    setProvenanceRadio(type)
    setContextMenu((c) => ({ ...c, open: false }))
  }
  const handleContextEdit = () => {
    if (contextMenu.nodeId) handleNodeEdit(contextMenu.nodeId)
    setContextMenu((c) => ({ ...c, open: false }))
  }
  const handleContextDelete = () => {
    setSelectedNode(contextMenu.nodeId)
    setTimeout(() => handleDeleteNode(), 0)
    setContextMenu((c) => ({ ...c, open: false }))
  }
  const handleContextChangeValue = (value: "accepted" | "defeated" | "undecided") => {
    if (!contextMenu.nodeId) return;
    const node = getArgument(contextMenu.nodeId);
    if (!node) return;

    const newFramework: ArgumentFramework = {
      ...framework,
      args: framework.args.map((arg) =>
        arg.id === contextMenu.nodeId
          ? {
            ...arg,
            value: value,
          }
          : arg
      ),
    };
    onFrameworkChange(newFramework);

    // Recompute semantics with the updated framework and propagate changes
    const updatedResult = computeSemantics(newFramework, semantics);
    setSemanticResult(updatedResult);

    // Only propagate values to nodes that already have manual values set
    const propagatedFramework: ArgumentFramework = {
      ...newFramework,
      args: newFramework.args.map((arg) => {
        // If this node has a manual value, update it based on new semantics
        if (arg.value) {
          if (updatedResult.accepted.includes(arg.id)) {
            return { ...arg, value: "accepted" };
          } else if (updatedResult.rejected.includes(arg.id)) {
            return { ...arg, value: "defeated" };
          } else {
            return { ...arg, value: "undecided" };
          }
        }
        // If no manual value, keep it as is (no value set)
        return arg;
      }),
    };

    // Update the framework with propagated values
    onFrameworkChange(propagatedFramework);
    setContextMenu((c) => ({ ...c, open: false }));
  };

  // Edge context menu actions
  const handleEdgeContextEdit = () => {
    if (edgeContextMenu.edgeId) {
      // Extract source and target from edge ID (format: "source-target")
      const [from, to] = edgeContextMenu.edgeId.split('-')
      const attack = framework.attacks.find(a => a.from === from && a.to === to)
      if (attack) {
        setEdgeToEdit(attack)
        setIsEdgeEditorOpen(true)
      }
    }
    setEdgeContextMenu((c) => ({ ...c, open: false }))
  }

  const handleEdgeContextDelete = () => {
    if (edgeContextMenu.edgeId) {
      // Extract source and target from edge ID (format: "source-target")
      const [from, to] = edgeContextMenu.edgeId.split('-')
      const newFramework: ArgumentFramework = {
        ...framework,
        attacks: framework.attacks.filter(a => !(a.from === from && a.to === to))
      }
      onFrameworkChange(newFramework)
    }
    setEdgeContextMenu((c) => ({ ...c, open: false }))
  }

  // Delete the selected node
  const handleDeleteNode = () => {
    if (!selectedNode) return
    // Remove the node and all its edges
    const newFramework: ArgumentFramework = {
      ...framework,
      args: framework.args.filter((arg) => arg.id !== selectedNode),
      attacks: framework.attacks.filter((attack) => attack.from !== selectedNode && attack.to !== selectedNode),
    }
    onFrameworkChange(newFramework)
    setSelectedNode(null)
    clearHighlighting()
  }

  // Handle layout change
  const handleLayoutChange = (layoutName: string) => {
    setCurrentLayout(layoutName)
  }

  // Zoom controls
  const handleZoomIn = () => {
    if (!cyRef.current) return
    cyRef.current.zoom({
      level: cyRef.current.zoom() * 1.2,
      renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
    })
  }

  const handleZoomOut = () => {
    if (!cyRef.current) return
    cyRef.current.zoom({
      level: cyRef.current.zoom() / 1.2,
      renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
    })
  }

  const handleFitToWindow = () => {
    if (!cyRef.current) return
    cyRef.current.fit()
  }

  // Get the argument for the hovered node
  const hoveredArgument = hoveredNode ? getArgument(hoveredNode) : null

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex justify-between mb-4">
        <div>
          {/* Removed selectedEdge and delete button from here, now handled in floating panel */}
        </div>
      </div>

      <div className="relative">
        <div ref={containerRef} className="flex-1 w-full" />

        {/* Node context menu */}
        {contextMenu.open && (
          <div
            className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[200px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <div className="relative group">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  Show Provenance
                  <span className="text-gray-400">▶</span>
                </button>
                <div className="absolute left-full top-0 ml-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextProvenance("potential"); }}
                  >
                    Potential Provenance
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextProvenance("primary"); }}
                  >
                    Primary Provenance
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextProvenance("actual"); }}
                  >
                    Actual Provenance
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-100 my-1"></div>
              <div className="relative group">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  Change Value
                  <span className="text-gray-400">▶</span>
                </button>
                <div className="absolute left-full top-0 ml-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextChangeValue("accepted"); }}
                  >
                    Accepted
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextChangeValue("defeated"); }}
                  >
                    Defeated
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => { e.stopPropagation(); handleContextChangeValue("undecided"); }}
                  >
                    Undecided
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                onMouseDown={(e) => { e.stopPropagation(); handleContextEdit(); }}
              >
                Edit Node
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600"
                onMouseDown={(e) => { e.stopPropagation(); handleContextDelete(); }}
              >
                Delete Node
              </button>
            </div>
          </div>
        )}

        {/* Edge context menu */}
        {edgeContextMenu.open && (
          <div
            className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[200px]"
            style={{
              left: edgeContextMenu.x,
              top: edgeContextMenu.y,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                onMouseDown={(e) => { e.stopPropagation(); handleEdgeContextEdit(); }}
              >
                Edit Edge
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600"
                onMouseDown={(e) => { e.stopPropagation(); handleEdgeContextDelete(); }}
              >
                Delete Edge
              </button>
            </div>
          </div>
        )}

        {/* Top left controls */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleFitToWindow}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleResetGraph}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <GraphvizConfig
            framework={framework}
            semantics={semantics}
            config={graphvizConfig}
            onConfigChange={setGraphvizConfig}
            onDownloadGv={downloadGraphvizFile}
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full" />

      {framework && (
        <div className="absolute bottom-4 right-4 z-10 bg-white/90 rounded-md shadow-md p-3 flex flex-col gap-2 border">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#40cfff" }}></div>
            <span className="text-sm">Accepted</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#ffb763" }}></div>
            <span className="text-sm">Rejected</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#fefe62" }}></div>
            <span className="text-sm">Undecided</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full border-2 border-red-500 border-dashed bg-transparent mr-2"></div>
            <span className="text-sm">Attacker</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full border-2 border-green-500 border-dashed bg-transparent mr-2"></div>
            <span className="text-sm">Defender</span>
          </div>
        </div>
      )}

      {/* Remove or comment out the tooltip rendering */}
      {/* {hoveredNode && (
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
      )} */}

      <NodeEditor
        isOpen={isNodeEditorOpen}
        onClose={() => setIsNodeEditorOpen(false)}
        onSave={handleSaveNodeEdit}
        node={nodeToEdit}
      />

      <EdgeEditor
        isOpen={isEdgeEditorOpen}
        onClose={() => setIsEdgeEditorOpen(false)}
        onSave={handleSaveEdgeEdit}
        edge={edgeToEdit}
      />
    </div>
  )
}
