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
  direction: "LR" | "TB"
  acceptedColor: string
  rejectedColor: string
  undecidedColor: string
  showLengthLabels: boolean
}

interface GraphvizConfigProps {
  framework: ArgumentFramework
  semantics: Semantics | null
  config: GraphvizConfig
  onConfigChange: (config: GraphvizConfig) => void
  onDownloadGv: () => void
}

export default function GraphvizConfig({
  framework,
  semantics,
  config,
  onConfigChange,
  onDownloadGv,
}: GraphvizConfigProps) {
  const handleConfigChange = (key: keyof GraphvizConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value,
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="bottom" align="start" sideOffset={5}>
        <div className="space-y-4">
          <h3 className="font-medium">Graph Configuration</h3>

          <div className="space-y-2">
            <Label>Layout Direction</Label>
            <Select value={config.direction} onValueChange={(value) => handleConfigChange("direction", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LR">Left to Right</SelectItem>
                <SelectItem value="TB">Top to Bottom</SelectItem>
              </SelectContent>
            </Select>
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
            <Label htmlFor="showLengthLabels">Show Length Labels</Label>
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
