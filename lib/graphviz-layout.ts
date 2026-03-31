import { Graphviz } from "@hpcc-js/wasm-graphviz"

let graphvizInstance: Graphviz | null = null

/**
 * Get or initialize the Graphviz WASM instance
 */
async function getGraphviz(): Promise<Graphviz> {
  if (!graphvizInstance) {
    graphvizInstance = await Graphviz.load()
  }
  return graphvizInstance
}

/**
 * Node position from Graphviz layout
 */
export interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Edge spline points from Graphviz layout
 */
export interface EdgeSpline {
  from: string
  to: string
  points: Array<{ x: number; y: number }>
}

/**
 * Layout result from Graphviz
 */
export interface GraphvizLayoutResult {
  positions: Record<string, NodePosition>
  edges: EdgeSpline[]
  boundingBox: { width: number; height: number }
}

/**
 * Parse Graphviz JSON output to extract node positions
 * Graphviz JSON format has objects array with pos as "x,y" string
 */
function parseGraphvizJson(jsonOutput: string): GraphvizLayoutResult {
  const parsed = JSON.parse(jsonOutput)
  const positions: Record<string, NodePosition> = {}
  const edges: EdgeSpline[] = []
  
  // Get bounding box
  const bb = parsed.bb?.split(",").map(Number) || [0, 0, 1000, 1000]
  const boundingBox = {
    width: bb[2] - bb[0],
    height: bb[3] - bb[1],
  }

  // Parse nodes (objects array)
  if (parsed.objects) {
    for (const obj of parsed.objects) {
      // Skip subgraphs and edges
      if (obj._gvid === undefined || !obj.name || obj.name.startsWith("cluster")) continue
      
      // Node name might be quoted
      const name = obj.name.replace(/^"|"$/g, "")
      
      if (obj.pos) {
        const [x, y] = obj.pos.split(",").map(Number)
        // Graphviz uses points (72 per inch), convert to reasonable pixel values
        // Also flip Y axis since Graphviz has origin at bottom-left
        positions[name] = {
          x: x,
          y: boundingBox.height - y, // Flip Y axis
          width: (obj.width || 0.75) * 72, // Convert inches to points
          height: (obj.height || 0.75) * 72,
        }
      }
    }
  }

  // Parse edges
  if (parsed.edges) {
    for (const edge of parsed.edges) {
      if (edge._draw_) {
        const fromNode = parsed.objects?.[edge.tail]?.name?.replace(/^"|"$/g, "")
        const toNode = parsed.objects?.[edge.head]?.name?.replace(/^"|"$/g, "")
        
        if (fromNode && toNode) {
          const points: Array<{ x: number; y: number }> = []
          
          // Extract spline points from _draw_ operations
          for (const op of edge._draw_) {
            if (op.op === "b" || op.op === "B") {
              // Bezier curve points
              for (let i = 0; i < op.points.length; i++) {
                points.push({
                  x: op.points[i][0],
                  y: boundingBox.height - op.points[i][1],
                })
              }
            }
          }
          
          edges.push({ from: fromNode, to: toNode, points })
        }
      }
    }
  }

  return { positions, edges, boundingBox }
}

/**
 * Get node positions from a DOT string using Graphviz WASM
 * @param dotString - The DOT language string
 * @returns Promise with node positions and layout info
 */
export async function getGraphvizLayout(dotString: string): Promise<GraphvizLayoutResult> {
  const graphviz = await getGraphviz()
  
  // Use JSON output format to get positions
  const jsonOutput = graphviz.dot(dotString, "json")
  
  return parseGraphvizJson(jsonOutput)
}

/**
 * Render DOT string to SVG using Graphviz WASM
 * @param dotString - The DOT language string
 * @returns SVG string
 */
export async function renderGraphvizSvg(dotString: string): Promise<string> {
  const graphviz = await getGraphviz()
  return graphviz.dot(dotString, "svg")
}
