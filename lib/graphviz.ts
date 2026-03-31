import type { ArgumentFramework, Semantics, SemanticsResult } from "./types"
import type { GraphvizConfig } from "@/components/graphviz-config"

/**
 * Generate Graphviz DOT language from an argumentation framework
 * @param framework - The argumentation framework
 * @param semantics - The selected semantics
 * @param config - Graphviz configuration
 * @param semanticsResult - Result for coloring nodes (current semantics)
 * @param groundedResult - Result for length labels (always from grounded semantics)
 */
export function generateGraphvizDot(
  framework: ArgumentFramework,
  semantics: Semantics,
  config: GraphvizConfig,
  semanticsResult?: SemanticsResult,
  groundedResult?: SemanticsResult,
): string {
  // Start building the DOT file
  let dot = `digraph ArgumentationFramework {\n`

  // Set graph direction
  dot += `  rankdir=${config.direction};\n`

  // Set node defaults
  dot += `  node [shape=circle, style=filled, fontname="Arial"];\n`
  dot += `  edge [arrowhead=normal];\n\n`

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

  // Add edges
  framework.attacks.forEach((attack) => {
    const edgeAttrs = []
    if (attack.annotation) {
      edgeAttrs.push(`label="${attack.annotation.replace(/"/g, '\\"')}"`)
    }

    dot += `  "${attack.from}" -> "${attack.to}"${edgeAttrs.length ? ` [${edgeAttrs.join(", ")}]` : ""};\n`
  })

  dot += "}\n"

  return dot
}
