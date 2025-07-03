"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { computeSemantics } from "@/lib/argumentation"
import type { ArgumentFramework, Semantics } from "@/lib/types"

interface SemanticsPanelProps {
  framework: ArgumentFramework | null
  selectedSemantics: Semantics
  onSemanticsChange: (semantics: Semantics) => void
}

export default function SemanticsPanel({ framework, selectedSemantics, onSemanticsChange }: SemanticsPanelProps) {
  const semanticsOptions: { value: Semantics; label: string; description: string }[] = [
    {
      value: "grounded",
      label: "Grounded Semantics",
      description: "The minimal complete extension (skeptical approach)",
    },
    {
      value: "preferred",
      label: "Preferred Semantics",
      description: "Maximal admissible sets of arguments",
    },
    {
      value: "stable",
      label: "Stable Semantics",
      description: "Extensions that attack all arguments not in the extension",
    },
    {
      value: "complete",
      label: "Complete Semantics",
      description: "Admissible sets that contain all their defended arguments",
    },
  ]

  // Compute semantics results if framework exists
  const semanticsResult = framework ? computeSemantics(framework, selectedSemantics) : null

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Semantics</CardTitle>
        <CardDescription>Select semantics to evaluate the argumentation framework</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedSemantics}
          onValueChange={(value) => onSemanticsChange(value as Semantics)}
          className="space-y-4"
        >
          {semanticsOptions.map((option) => (
            <div key={option.value} className="flex items-start space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <div className="grid gap-1">
                <Label htmlFor={option.value} className="font-medium">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Evaluation Results</h3>

          {!framework ? (
            <p className="text-sm text-muted-foreground">Load a framework to see evaluation results</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium mb-2">Accepted Arguments</h4>
                <div className="flex flex-wrap gap-2">
                  {semanticsResult?.accepted.length ? (
                    semanticsResult.accepted.map((arg) => (
                      <Badge key={arg} variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                        {arg}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No accepted arguments</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium mb-2">Rejected Arguments</h4>
                <div className="flex flex-wrap gap-2">
                  {semanticsResult?.rejected.length ? (
                    semanticsResult.rejected.map((arg) => (
                      <Badge key={arg} variant="outline" className="bg-red-100 text-red-800 hover:bg-red-200">
                        {arg}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No rejected arguments</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium mb-2">Undecided Arguments</h4>
                <div className="flex flex-wrap gap-2">
                  {semanticsResult?.undecided.length ? (
                    semanticsResult.undecided.map((arg) => (
                      <Badge key={arg} variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                        {arg}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No undecided arguments</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
