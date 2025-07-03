"use client"

import { useState } from "react"
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
  allowBackwardArrows: boolean
  rankSameGroups: string[][]
}

interface GraphvizConfigProps {
  framework: ArgumentFramework
  semantics: Semantics
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
  const [rankSameInput, setRankSameInput] = useState("")

  const handleConfigChange = (key: keyof GraphvizConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value,
    })
  }

  const addRankSameGroup = () => {
    if (!rankSameInput.trim()) return

    const nodes = rankSameInput
      .split(",")
      .map((node) => node.trim())
      .filter((node) => framework.args.some((arg) => arg.id === node))

    if (nodes.length > 1) {
      handleConfigChange("rankSameGroups", [...config.rankSameGroups, nodes])
      setRankSameInput("")
    }
  }

  const removeRankSameGroup = (index: number) => {
    const newGroups = [...config.rankSameGroups]
    newGroups.splice(index, 1)
    handleConfigChange("rankSameGroups", newGroups)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center">
          <Settings className="mr-2 h-4 w-4" />
          Graphviz Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="space-y-4">
          <h3 className="font-medium">Graphviz Configuration</h3>

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
              id="allowBackwardArrows"
              checked={config.allowBackwardArrows}
              onCheckedChange={(checked) => handleConfigChange("allowBackwardArrows", checked)}
            />
            <Label htmlFor="allowBackwardArrows">Allow Backward Arrows</Label>
          </div>

          <div className="space-y-2">
            <Label>Rank Same Groups</Label>
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., A, B, C"
                value={rankSameInput}
                onChange={(e) => setRankSameInput(e.target.value)}
              />
              <Button onClick={addRankSameGroup} type="button" size="sm">
                Add
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {config.rankSameGroups.map((group, index) => (
                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                  <span className="text-sm">{group.join(", ")}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeRankSameGroup(index)} className="h-6 w-6 p-0">
                    &times;
                  </Button>
                </div>
              ))}
            </div>
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
