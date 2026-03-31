"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { HelpCircle, X } from "lucide-react"
import { computeSemantics } from "@/lib/argumentation"
import type { ArgumentFramework, Semantics, SemanticsResult, Extension } from "@/lib/types"
import { useEffect, useState, useRef } from "react"

interface SemanticsPanelProps {
  framework: ArgumentFramework | null
  selectedSemantics: Semantics | null
  onSemanticsChange: (semantics: Semantics | null) => void
  onExtensionSelect?: (extension: string[], rejected: string[], undecided: string[]) => void
}

// Label filter options
type LabelFilter = "IN" | "UNDEC" | "OUT"

export default function SemanticsPanel({ framework, selectedSemantics, onSemanticsChange, onExtensionSelect }: SemanticsPanelProps) {
  const [semanticsResult, setSemanticsResult] = useState<SemanticsResult | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [selectedExtensionValue, setSelectedExtensionValue] = useState<string | null>(null)
  const [labelFilters, setLabelFilters] = useState<LabelFilter[]>(["IN"])
  const computationIdRef = useRef(0)

  // Semantics options in the correct order: Grounded, Stable, Preferred, Complete
  const semanticsOptions: { value: Semantics; label: string; description: string }[] = [
    {
      value: "grounded",
      label: "Grounded",
      description: "The minimal complete extension (skeptical approach)",
    },
    {
      value: "stable",
      label: "Stable",
      description: "Extensions that attack all arguments not in the extension",
    },
    {
      value: "preferred",
      label: "Preferred",
      description: "Maximal admissible sets of arguments",
    },
    {
      value: "complete",
      label: "Complete",
      description: "Admissible sets that contain all their defended arguments",
    },
  ]

  // Compute semantics results when framework or semantics changes
  useEffect(() => {
    if (!framework || !selectedSemantics) {
      setSemanticsResult(null)
      setIsComputing(false)
      setSelectedExtensionValue(null)
      // Clear extension selection when semantics is cleared
      if (!selectedSemantics && onExtensionSelect) {
        onExtensionSelect([], [], [])
      }
      return
    }

    const currentId = ++computationIdRef.current
    setIsComputing(true)
    setSemanticsResult(null)
    setSelectedExtensionValue(null)

    const runComputation = async () => {
      try {
        const result = await computeSemantics(framework, selectedSemantics)
        if (currentId === computationIdRef.current) {
          setSemanticsResult(result)
          setIsComputing(false)
          
          // Auto-select the first extension based on semantics type
          if (selectedSemantics === "grounded") {
            const value = createExtensionValue(result.accepted, result.undecided, result.rejected)
            setSelectedExtensionValue(value)
          } else if (selectedSemantics === "stable") {
            // Select first stable extension if available
            if (result.extensions && result.extensions.length > 0) {
              const ext = result.extensions[0]
              const rejected = computeRejectedFromExtension(framework, ext.members)
              const undecided = computeUndecidedFromExtension(framework, ext.members, rejected)
              const value = createExtensionValue(ext.members, undecided, rejected)
              setSelectedExtensionValue(value)
            }
          } else if (selectedSemantics === "preferred") {
            // Select first stable extension, or first preferred non-stable if no stable
            if (result.stableExtensions && result.stableExtensions.length > 0) {
              const ext = result.stableExtensions[0]
              const rejected = computeRejectedFromExtension(framework, ext.members)
              const undecided = computeUndecidedFromExtension(framework, ext.members, rejected)
              const value = createExtensionValue(ext.members, undecided, rejected)
              setSelectedExtensionValue(value)
            } else if (result.preferredNonStableExtensions && result.preferredNonStableExtensions.length > 0) {
              const ext = result.preferredNonStableExtensions[0]
              const rejected = computeRejectedFromExtension(framework, ext.members)
              const undecided = computeUndecidedFromExtension(framework, ext.members, rejected)
              const value = createExtensionValue(ext.members, undecided, rejected)
              setSelectedExtensionValue(value)
            }
          } else if (selectedSemantics === "complete" && result.groundedExtension) {
            const rejected = computeRejectedFromExtension(framework, result.groundedExtension)
            const undecided = computeUndecidedFromExtension(framework, result.groundedExtension, rejected)
            const value = createExtensionValue(result.groundedExtension, undecided, rejected)
            setSelectedExtensionValue(value)
          }
        }
      } catch (error) {
        console.error("Error computing semantics:", error)
        if (currentId === computationIdRef.current) {
          setIsComputing(false)
        }
      }
    }

    runComputation()
  }, [framework, selectedSemantics])

  // Notify parent when extension selection changes
  useEffect(() => {
    if (onExtensionSelect && selectedExtensionValue) {
      const { inArgs, undecArgs, outArgs } = parseExtensionValue(selectedExtensionValue)
      onExtensionSelect(inArgs, outArgs, undecArgs)
    }
  }, [selectedExtensionValue, onExtensionSelect])

  // Helper to compute rejected arguments from an extension
  const computeRejectedFromExtension = (fw: ArgumentFramework, extension: string[]): string[] => {
    const rejected: string[] = []
    for (const arg of fw.args) {
      if (extension.includes(arg.id)) continue
      const isAttacked = fw.attacks.some(
        attack => extension.includes(attack.from) && attack.to === arg.id
      )
      if (isAttacked) {
        rejected.push(arg.id)
      }
    }
    return rejected
  }

  // Helper to compute undecided arguments
  const computeUndecidedFromExtension = (fw: ArgumentFramework, extension: string[], rejected: string[]): string[] => {
    return fw.args
      .map(arg => arg.id)
      .filter(id => !extension.includes(id) && !rejected.includes(id))
  }

  // Create extension value string (format: "IN_ARGS|UNDEC_ARGS|OUT_ARGS")
  const createExtensionValue = (inArgs: string[], undecArgs: string[], outArgs: string[]): string => {
    return `${inArgs.sort().join("+")}|${undecArgs.sort().join("+")}|${outArgs.sort().join("+")}`
  }

  // Parse extension value string
  const parseExtensionValue = (value: string): { inArgs: string[], undecArgs: string[], outArgs: string[] } => {
    const parts = value.split("|")
    return {
      inArgs: parts[0] ? parts[0].split("+").filter(a => a) : [],
      undecArgs: parts[1] ? parts[1].split("+").filter(a => a) : [],
      outArgs: parts[2] ? parts[2].split("+").filter(a => a) : [],
    }
  }

  // Format extension label based on selected filters
  const formatExtensionLabel = (value: string): string => {
    const { inArgs, undecArgs, outArgs } = parseExtensionValue(value)
    
    const sections: string[] = []
    
    if (labelFilters.includes("IN")) {
      if (labelFilters.length === 1) {
        // Single label style
        sections.push(`{${inArgs.join(", ")}}`)
      } else {
        sections.push(`IN={${inArgs.join(", ")}}`)
      }
    }
    if (labelFilters.includes("UNDEC")) {
      sections.push(`UNDEC={${undecArgs.join(", ")}}`)
    }
    if (labelFilters.includes("OUT")) {
      sections.push(`OUT={${outArgs.join(", ")}}`)
    }
    
    return sections.length > 0 ? sections.join("\n") : "{}"
  }

  // Toggle label filter
  const toggleLabelFilter = (filter: LabelFilter) => {
    setLabelFilters(prev => {
      if (prev.includes(filter)) {
        // Don't allow removing the last filter
        if (prev.length === 1) return prev
        return prev.filter(f => f !== filter)
      } else {
        return [...prev, filter]
      }
    })
  }

  // Render extension radio item
  const renderExtensionRadio = (value: string, groupName: string) => (
    <div
      key={value}
      className={`p-2 rounded border cursor-pointer transition-colors ${
        selectedExtensionValue === value 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-400'
      }`}
      style={{ 
        borderStyle: 'dotted',
        borderWidth: '2px',
        borderColor: selectedExtensionValue === value ? '#87CEEB' : '#ADD8E6'
      }}
      onClick={() => setSelectedExtensionValue(value)}
    >
      <span className="text-sm font-mono whitespace-pre-line">{formatExtensionLabel(value)}</span>
    </div>
  )

  // Get all extensions for a category
  const getExtensionValues = (extensions: Extension[] | undefined): string[] => {
    if (!extensions || !framework) return []
    return extensions.map(ext => {
      const rejected = computeRejectedFromExtension(framework, ext.members)
      const undecided = computeUndecidedFromExtension(framework, ext.members, rejected)
      return createExtensionValue(ext.members, undecided, rejected)
    })
  }

  const renderGroundedResults = () => {
    if (!semanticsResult || !framework) return null

    const value = createExtensionValue(
      semanticsResult.accepted, 
      semanticsResult.undecided, 
      semanticsResult.rejected
    )

    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-bold mb-2">Grounded Extension:</h4>
          {renderExtensionRadio(value, "grounded")}
        </div>
      </div>
    )
  }

  const renderStableResults = () => {
    if (!semanticsResult || !framework) return null

    const extensionValues = getExtensionValues(semanticsResult.extensions)

    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-bold mb-2">Stable Extensions:</h4>
          {extensionValues.length > 0 ? (
            <div className="space-y-2">
              {extensionValues.map(value => renderExtensionRadio(value, "stable"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>
      </div>
    )
  }

  const renderPreferredResults = () => {
    if (!semanticsResult || !framework) return null

    const stableValues = getExtensionValues(semanticsResult.stableExtensions)
    const nonStableValues = getExtensionValues(semanticsResult.preferredNonStableExtensions)

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-bold mb-2">Stable Extensions:</h4>
          {stableValues.length > 0 ? (
            <div className="space-y-2">
              {stableValues.map(value => renderExtensionRadio(value, "stable"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold mb-2">Preferred Non-Stable Extensions:</h4>
          {nonStableValues.length > 0 ? (
            <div className="space-y-2">
              {nonStableValues.map(value => renderExtensionRadio(value, "preferred"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>
      </div>
    )
  }

  const renderCompleteResults = () => {
    if (!semanticsResult || !framework) return null

    const groundedExtension = semanticsResult.groundedExtension || semanticsResult.accepted
    const groundedRejected = computeRejectedFromExtension(framework, groundedExtension)
    const groundedUndecided = computeUndecidedFromExtension(framework, groundedExtension, groundedRejected)
    const groundedValue = createExtensionValue(groundedExtension, groundedUndecided, groundedRejected)

    const stableValues = getExtensionValues(semanticsResult.stableExtensions)
    const nonStableValues = getExtensionValues(semanticsResult.preferredNonStableExtensions)
    const otherCompleteValues = getExtensionValues(semanticsResult.otherCompleteExtensions)

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-bold mb-2">Grounded Extension:</h4>
          {renderExtensionRadio(groundedValue, "grounded")}
        </div>

        <div>
          <h4 className="text-xs font-bold mb-2">Preferred, Stable Extensions:</h4>
          {stableValues.length > 0 ? (
            <div className="space-y-2">
              {stableValues.map(value => renderExtensionRadio(value, "stable"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold mb-2">Preferred, Non-Stable Extensions:</h4>
          {nonStableValues.length > 0 ? (
            <div className="space-y-2">
              {nonStableValues.map(value => renderExtensionRadio(value, "preferred"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold mb-2">Other Complete Extensions:</h4>
          {otherCompleteValues.length > 0 ? (
            <div className="space-y-2">
              {otherCompleteValues.map(value => renderExtensionRadio(value, "other"))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-2">(none)</p>
          )}
        </div>
      </div>
    )
  }

  const renderResults = () => {
    switch (selectedSemantics) {
      case "grounded":
        return renderGroundedResults()
      case "stable":
        return renderStableResults()
      case "preferred":
        return renderPreferredResults()
      case "complete":
        return renderCompleteResults()
      default:
        return null
    }
  }

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle>Evaluation</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="max-w-xs text-sm">
              <p>Select semantics to evaluate the argumentation framework</p>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Semantics Selection */}
        <div className="flex items-center gap-2">
          <Label className="font-bold whitespace-nowrap">Semantics</Label>
          <select
            value={selectedSemantics || ""}
            onChange={(e) => onSemanticsChange(e.target.value ? e.target.value as Semantics : null)}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Select --</option>
            {semanticsOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedSemantics && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => onSemanticsChange(null)}
              title="Clear semantics"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {selectedSemantics && (
          <>
            {/* Show Labels Filter */}
            <div className="flex items-center gap-4">
              <Label className="font-bold whitespace-nowrap">Show labels</Label>
              <div className="flex gap-4">
                {(["IN", "UNDEC", "OUT"] as LabelFilter[]).map((filter) => (
                  <div key={filter} className="flex items-center gap-1">
                    <Checkbox
                      id={`filter-${filter}`}
                      checked={labelFilters.includes(filter)}
                      onCheckedChange={() => toggleLabelFilter(filter)}
                    />
                    <Label htmlFor={`filter-${filter}`} className="text-sm cursor-pointer">
                      {filter}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Results */}
            <div className="space-y-4">
              {!framework ? (
                <p className="text-sm text-muted-foreground">Load a framework to see evaluation results</p>
              ) : isComputing ? (
                <p className="text-sm text-muted-foreground">Computing semantics...</p>
              ) : (
                renderResults()
              )}
            </div>
          </>
        )}

        {!selectedSemantics && framework && (
          <p className="text-sm text-muted-foreground">Select a semantics to evaluate the framework</p>
        )}
      </CardContent>
    </Card>
  )
}
