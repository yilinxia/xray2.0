import type { ArgumentFramework, Semantics, SemanticsResult, EdgeInfo } from "./types"
import type { GraphvizConfig } from "@/components/graphviz-config"

/**
 * Edge style configuration based on edge type
 */
interface EdgeStyle {
  color: string
  style: "solid" | "dotted" | "dashed"
  arrowhead: string
  arrowtail: string
}

/**
 * Get style for edge type based on reference styling
 * - Winning (blue #1c72d4, solid): Accepted attacking defeated
 * - Delaying (orange #cc8400, solid): Defeated attacking accepted  
 * - Drawing (yellow #f1dd4b, solid): Undecided attacking undecided
 * - Blunder (gray #919191, dotted): Suboptimal moves
 */
function getEdgeStyle(edgeType: string): EdgeStyle {
  switch (edgeType) {
    case "winning":
      return { color: "#1c72d4", style: "solid", arrowhead: "vee", arrowtail: "vee" }
    case "delaying":
      return { color: "#cc8400", style: "solid", arrowhead: "vee", arrowtail: "vee" }
    case "drawing":
      return { color: "#f1dd4b", style: "solid", arrowhead: "vee", arrowtail: "vee" }
    case "blunder":
      return { color: "#919191", style: "dotted", arrowhead: "onormal", arrowtail: "onormal" }
    default:
      return { color: "#000000", style: "solid", arrowhead: "normal", arrowtail: "none" }
  }
}

/**
 * Generate a plain Graphviz DOT string (without semantics coloring)
 * @param framework - The argumentation framework
 * @param config - Graphviz configuration (only direction is used)
 */
export function generatePlainGraphvizDot(
  framework: ArgumentFramework,
  config: GraphvizConfig,
): string {
  // Convert pixel size to inches (Graphviz uses inches, roughly 72 pixels per inch)
  const nodeSizeInches = (config.nodeSize / 72).toFixed(2)

  // Start building the DOT file
  let dot = `digraph {\n`

  // Set graph direction
  dot += `  rankdir=${config.direction};\n\n`

  // Set node defaults
  dot += `  node [fontname="helvetica", shape=circle, fixedsize=true, width=${nodeSizeInches}, height=${nodeSizeInches}];\n`

  // Add nodes
  framework.args.forEach((arg) => {
    const nodeAttrs = [
      `label="${arg.id}"`,
      `fontsize=14`,
      `cursor="pointer"`,
      `id="node-${arg.id}"`,
    ]

    if (arg.annotation) {
      nodeAttrs.push(`tooltip="${arg.annotation.replace(/"/g, '\\"')}"`)
    }

    dot += `  "${arg.id}" [${nodeAttrs.join(", ")}];\n`
  })

  dot += "\n"

  // Set edge defaults
  dot += `  edge [labeldistance=1.5, fontsize=12, fontname="helvetica"];\n`

  // Add edges (simple, no styling)
  framework.attacks.forEach((attack) => {
    dot += `  "${attack.from}" -> "${attack.to}";\n`
  })

  dot += "}\n"

  return dot
}

/**
 * Generate Graphviz DOT language from an argumentation framework with semantics
 * @param framework - The argumentation framework
 * @param semantics - The selected semantics
 * @param config - Graphviz configuration
 * @param semanticsResult - Result for coloring nodes (current semantics)
 * @param groundedResult - Result for length labels and edge types (always from grounded semantics)
 */
export function generateGraphvizDot(
  framework: ArgumentFramework,
  semantics: Semantics | null,
  config: GraphvizConfig,
  semanticsResult?: SemanticsResult,
  groundedResult?: SemanticsResult,
): string {
  // If no semantics selected, generate plain graph
  if (!semantics) {
    return generatePlainGraphvizDot(framework, config)
  }

  // Start building the DOT file
  let dot = `digraph ArgumentationFramework {\n`

  // Set graph direction
  dot += `  rankdir=${config.direction};\n`

  // Set node defaults
  dot += `  node [shape=circle, style=filled, fontname="helvetica"];\n`
  dot += `  edge [labeldistance=1.5, fontsize=12, fontname="helvetica"];\n\n`

  // Build edge info map for quick lookup
  const edgeInfoMap = new Map<string, EdgeInfo>()
  if (groundedResult?.edges) {
    for (const edge of groundedResult.edges) {
      edgeInfoMap.set(`${edge.from}->${edge.to}`, edge)
    }
  }

  // Add nodes with appropriate colors
  framework.args.forEach((arg) => {
    let color = config.undecidedColor
    let fontColor = "black"

    // Determine node color based on semantics result if available
    if (semanticsResult) {
      if (semanticsResult.accepted.includes(arg.id)) {
        color = config.acceptedColor
      } else if (semanticsResult.rejected.includes(arg.id)) {
        color = config.rejectedColor
      }
    }

    // Calculate contrasting font color (simple version)
    const r = Number.parseInt(color.slice(1, 3), 16)
    const g = Number.parseInt(color.slice(3, 5), 16)
    const b = Number.parseInt(color.slice(5, 7), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 128) {
      fontColor = "white"
    }

    // Determine node label (with or without length from grounded semantics)
    let nodeLabel = arg.id
    if (config.showLengthLabels && groundedResult?.provenance?.[arg.id]?.length !== undefined) {
      const len = groundedResult.provenance[arg.id].length
      nodeLabel = len === Infinity ? `${arg.id}.∞` : `${arg.id}.${len}`
    }

    // Add node with tooltip (annotation) and URL if available
    const nodeAttrs = [`label="${nodeLabel}"`, `fillcolor="${color}"`, `fontcolor="${fontColor}"`]

    if (arg.annotation) {
      nodeAttrs.push(`tooltip="${arg.annotation.replace(/"/g, '\\"')}"`)
    }

    if (arg.url) {
      nodeAttrs.push(`URL="${arg.url}"`)
    }

    dot += `  "${arg.id}" [${nodeAttrs.join(", ")}];\n`
  })

  dot += "\n"

  // Add edges with optional type labels and styling
  framework.attacks.forEach((attack) => {
    const edgeAttrs: string[] = []
    const edgeKey = `${attack.from}->${attack.to}`
    const edgeInfo = edgeInfoMap.get(edgeKey)
    
    // Add edge styling if enabled
    if (config.showEdgeLabels && edgeInfo) {
      const style = getEdgeStyle(edgeInfo.type)
      
      edgeAttrs.push(`color="${style.color}"`)
      edgeAttrs.push(`style="${style.style}"`)
      edgeAttrs.push(`fontcolor="${style.color}"`)
      edgeAttrs.push(`arrowhead="${style.arrowhead}"`)
      edgeAttrs.push(`arrowtail="${style.arrowtail}"`)
      
      // Add taillabel with length (except for blunder which has no label)
      if (edgeInfo.type !== "blunder") {
        const lengthStr = edgeInfo.length === "∞" ? "∞" : String(edgeInfo.length)
        edgeAttrs.push(`taillabel="${lengthStr}"`)
      } else {
        edgeAttrs.push(`taillabel=""`)
      }
    } else if (attack.annotation) {
      edgeAttrs.push(`label="${attack.annotation.replace(/"/g, '\\"')}"`)
    }

    dot += `  "${attack.from}" -> "${attack.to}"${edgeAttrs.length ? ` [${edgeAttrs.join(", ")}]` : ""};\n`
  })

  dot += "}\n"

  return dot
}
