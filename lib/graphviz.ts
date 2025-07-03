import type { ArgumentFramework, Semantics } from "./types"
import { computeSemantics } from "./argumentation"
import type { GraphvizConfig } from "@/components/graphviz-config"

/**
 * Generate Graphviz DOT language from an argumentation framework
 */
export function generateGraphvizDot(
  framework: ArgumentFramework,
  semantics: Semantics,
  config: GraphvizConfig,
): string {
  // Compute semantics to determine node colors
  const semanticsResult = computeSemantics(framework, semantics)

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

    // Determine node color based on semantics
    if (semanticsResult.accepted.includes(arg.id)) {
      color = config.acceptedColor
    } else if (semanticsResult.rejected.includes(arg.id)) {
      color = config.rejectedColor
    }

    // Calculate contrasting font color (simple version)
    const r = Number.parseInt(color.slice(1, 3), 16)
    const g = Number.parseInt(color.slice(3, 5), 16)
    const b = Number.parseInt(color.slice(5, 7), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 128) {
      fontColor = "white"
    }

    // Add node with tooltip (annotation) and URL if available
    const nodeAttrs = [`fillcolor="${color}"`, `fontcolor="${fontColor}"`]

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
    // Skip backward arrows if not allowed
    if (!config.allowBackwardArrows) {
      const fromIndex = framework.args.findIndex((arg) => arg.id === attack.from)
      const toIndex = framework.args.findIndex((arg) => arg.id === attack.to)
      if (fromIndex > toIndex) {
        return
      }
    }

    const edgeAttrs = []
    if (attack.annotation) {
      edgeAttrs.push(`label="${attack.annotation.replace(/"/g, '\\"')}"`)
    }

    dot += `  "${attack.from}" -> "${attack.to}"${edgeAttrs.length ? ` [${edgeAttrs.join(", ")}]` : ""};\n`
  })

  dot += "\n"

  // Add rank=same constraints
  config.rankSameGroups.forEach((group) => {
    if (group.length > 1) {
      dot += `  { rank=same; ${group.map((id) => `"${id}"`).join("; ")}; }\n`
    }
  })

  dot += "}\n"

  return dot
}
