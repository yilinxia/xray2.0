"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, Settings } from "lucide-react"
import type { ArgumentFramework, Semantics } from "@/lib/types"

export interface GraphvizConfig {
  direction: "LR" | "TB" | "BT" | "RL"
  acceptedColor: string
  rejectedColor: string
  undecidedColor: string
  showLengthLabels: boolean
  showEdgeLabels: boolean
  useEdgeDirection: boolean
  nodeSize: number
  rankByLength: boolean
}

interface GraphvizConfigProps {
  framework: ArgumentFramework
  semantics: Semantics | null
  config: GraphvizConfig
  onConfigChange: (config: GraphvizConfig) => void
  onDownloadGv: () => void
  currentLayout?: string
  onLayoutChange?: (layout: string) => void
  layoutDirection?: "TB" | "BT" | "LR" | "RL"
  onDirectionChange?: (direction: "TB" | "BT" | "LR" | "RL") => void
  viewMode?: "view" | "edit"
}

const layoutOptions = [
  { value: "graphviz", label: "Graphviz (dot)" },
  { value: "dagre", label: "Layered (Dagre)" },
  { value: "cose", label: "Force-Directed" },
  { value: "breadthfirst", label: "Tree" },
  { value: "circle", label: "Circle" },
  { value: "grid", label: "Grid" },
  { value: "concentric", label: "Concentric" },
]

const directionOptions = [
  { value: "TB", label: "Top to Bottom" },
  { value: "BT", label: "Bottom to Top" },
  { value: "LR", label: "Left to Right" },
  { value: "RL", label: "Right to Left" },
]

export default function GraphvizConfig({
  framework,
  semantics,
  config,
  onConfigChange,
  onDownloadGv,
  currentLayout,
  onLayoutChange,
  layoutDirection,
  onDirectionChange,
  viewMode = "edit",
}: GraphvizConfigProps) {
  const handleConfigChange = (key: keyof GraphvizConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value,
    })
  }

  // Check if current layout supports direction (in edit mode)
  const supportsDirection = currentLayout === "dagre" || currentLayout === "graphviz"
  
  // In view mode, always show direction (Graphviz always supports it)
  const showDirection = viewMode === "view" || supportsDirection

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="left" align="start" sideOffset={5}>
        <div className="space-y-4">
          <h3 className="font-medium">Graph Configuration</h3>

          {/* Layout Algorithm - only show in edit mode */}
          {viewMode === "edit" && onLayoutChange && (
            <div className="space-y-2">
              <Label>Layout Algorithm</Label>
              <Select value={currentLayout} onValueChange={onLayoutChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Layout" />
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
          )}

          {/* Layout Direction - show in both modes when applicable */}
          {onDirectionChange && showDirection && (
            <div className="space-y-2">
              <Label>Layout Direction</Label>
              <Select value={layoutDirection} onValueChange={(value) => onDirectionChange(value as "TB" | "BT" | "LR" | "RL")}>
                <SelectTrigger>
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  {directionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nodeSize">Node Size: {config.nodeSize}px</Label>
            <Input
              id="nodeSize"
              type="range"
              min="10"
              max="120"
              step="5"
              value={config.nodeSize}
              onChange={(e) => handleConfigChange("nodeSize", parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="acceptedColor">Accepted</Label>
              <div className="flex items-center mt-1">
                <Input
                  id="acceptedColor"
                  type="color"
                  value={config.acceptedColor}
                  onChange={(e) => handleConfigChange("acceptedColor", e.target.value)}
                  className="w-full h-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rejectedColor">Rejected</Label>
              <div className="flex items-center mt-1">
                <Input
                  id="rejectedColor"
                  type="color"
                  value={config.rejectedColor}
                  onChange={(e) => handleConfigChange("rejectedColor", e.target.value)}
                  className="w-full h-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="undecidedColor">Undecided</Label>
              <div className="flex items-center mt-1">
                <Input
                  id="undecidedColor"
                  type="color"
                  value={config.undecidedColor}
                  onChange={(e) => handleConfigChange("undecidedColor", e.target.value)}
                  className="w-full h-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showLengthLabels"
              checked={config.showLengthLabels}
              onCheckedChange={(checked) => handleConfigChange("showLengthLabels", checked)}
            />
            <Label htmlFor="showLengthLabels">Show Node Length Labels</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showEdgeLabels"
              checked={config.showEdgeLabels}
              onCheckedChange={(checked) => handleConfigChange("showEdgeLabels", checked)}
            />
            <Label htmlFor="showEdgeLabels">Show Edge Type Labels</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="useEdgeDirection"
              checked={config.useEdgeDirection}
              onCheckedChange={(checked) => handleConfigChange("useEdgeDirection", checked)}
            />
            <Label htmlFor="useEdgeDirection">Use Edge Direction (dir=back)</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="rankByLength"
              checked={config.rankByLength}
              onCheckedChange={(checked) => handleConfigChange("rankByLength", checked)}
            />
            <Label htmlFor="rankByLength">Group by Length (rank=same)</Label>
          </div>

          <Button onClick={onDownloadGv} className="w-full flex items-center justify-center">
            <Download className="mr-2 h-4 w-4" />
            Download as .gv file
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
