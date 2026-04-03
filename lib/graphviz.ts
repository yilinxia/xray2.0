import type { ArgumentFramework, Semantics, SemanticsResult, EdgeInfo, EdgeType } from "./types"
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
  // Start building the DOT file
  let dot = `digraph {\n`

  // Set graph direction
  dot += `  rankdir=${config.direction}\n\n`

  // Set node defaults
  dot += `  node [fontname="helvetica", shape=circle, fixedsize=true, width=0.8, height=0.8]\n`

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

    dot += `  "${arg.id}" [${nodeAttrs.join(", ")}]\n`
  })

  dot += "\n"

  // Set edge defaults
  dot += `  edge[labeldistance=1.5 fontsize=12 fontname="helvetica"]\n`

  // Add edges (simple, no styling)
  framework.attacks.forEach((attack) => {
    dot += `  "${attack.from}" -> "${attack.to}"\n`
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
  let dot = `digraph {\n`
  dot += `layout=dot\n`

  // Set graph direction
  dot += `rankdir=${config.direction}\n\n`

  // Set node defaults
  dot += `node [fontname="helvetica" shape=circle fixedsize=true width=0.8, height=0.8]\n`

  // Build a map of node lengths for edge direction calculation
  const nodeLengths = new Map<string, number | string>()
  if (groundedResult?.provenance) {
    for (const [nodeId, prov] of Object.entries(groundedResult.provenance)) {
      if (prov.length !== undefined) {
        nodeLengths.set(nodeId, prov.length === Infinity ? "∞" : prov.length)
      }
    }
  }

  // Check if this is grounded semantics
  const isGroundedSemantics = semantics === "grounded"

  // Add nodes with appropriate colors
  framework.args.forEach((arg) => {
    let color = config.undecidedColor

    // Determine node color based on semantics result if available
    if (semanticsResult) {
      if (isGroundedSemantics) {
        // Grounded semantics: use standard colors
        if (semanticsResult.accepted.includes(arg.id)) {
          color = config.acceptedColor
        } else if (semanticsResult.rejected.includes(arg.id)) {
          color = config.rejectedColor
        }
      } else {
        // Non-grounded semantics: check if node was UNDEC in grounded for lighter colors
        const wasUndecidedInGrounded = groundedResult?.undecided?.includes(arg.id) ?? false

        if (semanticsResult.accepted.includes(arg.id)) {
          // Use lighter blue if was UNDEC in grounded, otherwise normal blue
          color = wasUndecidedInGrounded ? "#a6e9ff" : config.acceptedColor
        } else if (semanticsResult.rejected.includes(arg.id)) {
          // Use lighter orange if was UNDEC in grounded, otherwise normal orange
          color = wasUndecidedInGrounded ? "#ffe6c9" : config.rejectedColor
        }
      }
    }

    // Determine node label (with or without length from grounded semantics)
    let nodeLabel = arg.id
    if (config.showLengthLabels && groundedResult?.provenance?.[arg.id]?.length !== undefined) {
      const len = groundedResult.provenance[arg.id].length
      nodeLabel = len === Infinity ? `${arg.id}.∞` : `${arg.id}.${len}`
    }

    // Build node attributes
    const nodeAttrs = [
      `style="filled"`,
      `fillcolor="${color}"`,
      `label="${nodeLabel}"`,
      `fontsize=14`,
      `cursor="pointer"`,
    ]

    if (arg.annotation) {
      nodeAttrs.push(`tooltip="${arg.annotation.replace(/"/g, '\\"')}"`)
    }

    if (arg.url) {
      nodeAttrs.push(`URL="${arg.url}"`)
    }

    dot += `  "${arg.id}" [${nodeAttrs.join(" ")}]\n`
  })

  dot += "\n"

  // Set edge defaults
  dot += `edge[labeldistance=1.5 fontsize=12 fontname="helvetica"]\n`

  // Build edge info map for quick lookup
  // For non-grounded semantics, compute edge types based on current extension
  const edgeInfoMap = new Map<string, EdgeInfo>()

  if (semantics === "grounded" && groundedResult?.edges) {
    // For grounded semantics, use the pre-computed edges
    for (const edge of groundedResult.edges) {
      edgeInfoMap.set(`${edge.from}->${edge.to}`, edge)
    }
  } else if (semanticsResult && semantics !== "grounded") {
    // For non-grounded semantics, compute edge types based on current extension
    // Keep labels from grounded for edges that remain the same type, especially drawing (∞)
    const acceptedSet = new Set(semanticsResult.accepted)
    const rejectedSet = new Set(semanticsResult.rejected)
    const undecidedSet = new Set(semanticsResult.undecided)

    // Build grounded edge info map for comparison
    const groundedEdgeMap = new Map<string, EdgeInfo>()
    if (groundedResult?.edges) {
      for (const edge of groundedResult.edges) {
        groundedEdgeMap.set(`${edge.from}->${edge.to}`, edge)
      }
    }

    for (const attack of framework.attacks) {
      const fromAccepted = acceptedSet.has(attack.from)
      const fromRejected = rejectedSet.has(attack.from)
      const fromUndecided = undecidedSet.has(attack.from)
      const toAccepted = acceptedSet.has(attack.to)
      const toRejected = rejectedSet.has(attack.to)
      const toUndecided = undecidedSet.has(attack.to)

      let edgeType: EdgeType
      let length: number | string = ""  // Empty by default

      // Determine edge type based on the classification
      if (fromAccepted && toRejected) {
        edgeType = "winning"
      } else if (fromRejected && toAccepted) {
        edgeType = "delaying"
      } else if (fromUndecided && toUndecided) {
        edgeType = "drawing"
        // For drawing edges (undec -> undec), keep the ∞ label
        length = "∞"
      } else {
        edgeType = "blunder"
      }

      // Check if edge type changed from grounded - if drawing changed to something else, clear label
      const groundedEdge = groundedEdgeMap.get(`${attack.from}->${attack.to}`)
      if (groundedEdge && groundedEdge.type === edgeType) {
        // Edge type is the same as grounded, keep the original label
        length = groundedEdge.length
      }

      edgeInfoMap.set(`${attack.from}->${attack.to}`, {
        from: attack.from,
        to: attack.to,
        type: edgeType,
        length,
      })
    }
  } else if (groundedResult?.edges) {
    // Fallback to grounded edges if available
    for (const edge of groundedResult.edges) {
      edgeInfoMap.set(`${edge.from}->${edge.to}`, edge)
    }
  }

  // Add edges with optional type labels and styling
  framework.attacks.forEach((attack) => {
    const edgeKey = `${attack.from}->${attack.to}`
    const edgeInfo = edgeInfoMap.get(edgeKey)

    // If we have edge info, check for dir=back logic based on config
    if (edgeInfo) {
      const style = getEdgeStyle(edgeInfo.type)

      // Get lengths for from and to nodes
      const fromLen = nodeLengths.get(attack.from)
      const toLen = nodeLengths.get(attack.to)

      // Determine if this is an "against wind" edge (from higher length to lower length)
      // Against wind: fromLen > toLen (or fromLen is ∞ and toLen is not)
      let againstWind = false
      if (config.useEdgeDirection && fromLen !== undefined && toLen !== undefined) {
        const fromNum = fromLen === "∞" ? Infinity : (fromLen as number)
        const toNum = toLen === "∞" ? Infinity : (toLen as number)
        againstWind = fromNum > toNum
      }

      if (config.showEdgeLabels) {
        // Show full styling with colors and labels
        if (againstWind) {
          // Against wind edge: use dir=back to reverse arrow direction
          const edgeStyle = edgeInfo.type === "winning" ? "dashed" : style.style
          const labelStr = edgeInfo.type === "blunder" ? "" : (edgeInfo.length === "∞" ? "∞" : String(edgeInfo.length))
          dot += `  "${attack.to}" -> "${attack.from}" [dir=back color="${style.color}" style="${edgeStyle}" fontcolor="${style.color}" arrowtail="${style.arrowtail}" arrowhead="${style.arrowhead}" headlabel="${labelStr}"]\n`
        } else {
          // Normal edge direction
          const edgeAttrs = [
            `color="${style.color}"`,
            `style="${style.style}"`,
            `fontcolor="${style.color}"`,
            `arrowtail="${style.arrowtail}"`,
            `arrowhead="${style.arrowhead}"`,
          ]

          // Add taillabel with length (except for blunder which has no label)
          if (edgeInfo.type !== "blunder") {
            const lengthStr = edgeInfo.length === "∞" ? "∞" : String(edgeInfo.length)
            edgeAttrs.push(`taillabel="${lengthStr}"`)
          } else {
            edgeAttrs.push(`taillabel=""`)
          }

          dot += `  "${attack.from}" -> "${attack.to}" [${edgeAttrs.join(" ")}]\n`
        }
      } else {
        // Labels disabled, but still apply dir=back if enabled for proper edge direction
        if (againstWind) {
          dot += `  "${attack.to}" -> "${attack.from}" [dir=back]\n`
        } else {
          dot += `  "${attack.from}" -> "${attack.to}"\n`
        }
      }
    } else if (attack.annotation) {
      dot += `  "${attack.from}" -> "${attack.to}" [label="${attack.annotation.replace(/"/g, '\\"')}"]\n`
    } else {
      dot += `  "${attack.from}" -> "${attack.to}"\n`
    }
  })

  // Add rank=same statements if enabled and we have grounded result with provenance
  if (config.rankByLength && groundedResult?.provenance) {
    dot += "\n"

    // Group nodes by their length (exclude ∞ nodes from ranking)
    const nodesByLength = new Map<number, string[]>()

    framework.args.forEach((arg) => {
      const provenance = groundedResult.provenance[arg.id]
      if (provenance?.length !== undefined && provenance.length !== Infinity) {
        const len = provenance.length as number
        if (!nodesByLength.has(len)) {
          nodesByLength.set(len, [])
        }
        nodesByLength.get(len)!.push(arg.id)
      }
    })

    // Sort by length (numeric ascending)
    const sortedLengths = Array.from(nodesByLength.keys()).sort((a, b) => a - b)

    // Generate rank=same statements (ordered by length: 0, 1, 2, 3, 4, ...)
    for (const len of sortedLengths) {
      const nodes = nodesByLength.get(len)!
      if (nodes.length > 1) {
        // Only add rank=same if there are multiple nodes at this level
        const nodeList = nodes.join(" ")
        dot += `  {rank = same ${nodeList}}\n`
      } else if (nodes.length === 1) {
        // Comment out single-node ranks (following Python reference)
        dot += `  // {rank = same ${nodes[0]}}\n`
      }
    }
  }

  dot += "}\n"

  return dot
}
