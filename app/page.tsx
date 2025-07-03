"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload, FileText, RefreshCw, Database, PlusCircle, Edit, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
import ArgumentGraph from "@/components/argument-graph"
import SemanticsPanel from "@/components/semantics-panel"
import JsonEditor from "@/components/json-editor"
import { generateRandomFramework, parseFrameworkFile, exampleFrameworks } from "@/lib/argumentation"
import type { ArgumentFramework, Semantics } from "@/lib/types"

export default function ArgumentationFramework() {
  const [framework, setFramework] = useState<ArgumentFramework | null>(null)
  const [selectedSemantics, setSelectedSemantics] = useState<Semantics>("grounded")
  const [selectedExample, setSelectedExample] = useState<string>("")
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false)
  const { toast } = useToast()

  // Load an example framework when selected
  useEffect(() => {
    if (selectedExample) {
      const example = exampleFrameworks.find((ex) => ex.id === selectedExample)
      if (example) {
        setFramework(example.framework)
        toast({
          title: "Example loaded",
          description: `Loaded example: ${example.name}`,
        })
      }
    }
  }, [selectedExample, toast])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsedFramework = parseFrameworkFile(text)
      setFramework(parsedFramework)
      // Reset the file input
      if (event.target.form) {
        event.target.form.reset()
      }
      toast({
        title: "File uploaded",
        description: `Successfully parsed framework with ${parsedFramework.args.length} arguments`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse the uploaded file",
        variant: "destructive",
      })
    }
  }

  // Generate random framework
  const handleGenerateRandom = () => {
    const randomFramework = generateRandomFramework(5, 8)
    setFramework(randomFramework)
    toast({
      title: "Random framework generated",
      description: `Created framework with ${randomFramework.args.length} arguments and ${randomFramework.attacks.length} attacks`,
    })
  }

  // Handle framework changes (e.g., when an edge is deleted)
  const handleFrameworkChange = (newFramework: ArgumentFramework) => {
    setFramework(newFramework)
    toast({
      title: "Framework updated",
      description: "The framework has been updated",
    })
  }

  // Open JSON editor with current framework
  const openJsonEditor = () => {
    setIsJsonEditorOpen(true)
  }

  // Create new framework from JSON editor
  const handleCreateFramework = () => {
    setIsJsonEditorOpen(true)
  }

  // Download framework as JSON
  const downloadFramework = () => {
    if (!framework) return

    // Convert to the expected JSON format
    const jsonData = {
      name: framework.name || "Argumentation Framework",
      arguments: framework.args,
      defeats: framework.attacks,
    }

    // Create a blob and download link
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${jsonData.name.replace(/\s+/g, "-").toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Argumentation Framework Visualizer</CardTitle>
          <CardDescription>
            Upload, generate, or select an example to visualize arguments and attack relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Input Options</h3>
              <div className="flex flex-wrap gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".txt,.af,.json,.gv"
                          onChange={handleFileUpload}
                        />
                        <label htmlFor="file-upload">
                          <Button variant="outline" className="cursor-pointer" asChild>
                            <div>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload File
                            </div>
                          </Button>
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Upload a file containing arguments and attacks</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={handleGenerateRandom}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate Random
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate a random argumentation framework</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full md:w-64">
                        <Select value={selectedExample} onValueChange={setSelectedExample}>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <FileText className="mr-2 h-4 w-4" />
                              <SelectValue placeholder="Select Example" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {exampleFrameworks.map((example) => (
                              <SelectItem key={example.id} value={example.id}>
                                {example.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select from predefined examples</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Framework Actions</h3>
              <div className="flex flex-wrap gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={handleCreateFramework}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Framework
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a new framework manually</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {framework && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={openJsonEditor}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Framework
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit the current framework</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={downloadFramework}>
                            <Download className="mr-2 h-4 w-4" />
                            Download JSON
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download the current framework as JSON</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Argument Graph</CardTitle>
              <CardDescription>
                Hover over nodes to see information and hyperlinks. Click on a node to visualize how its value is
                calculated. Double-click to edit node properties.
              </CardDescription>
              {framework && (
                <div className="flex flex-wrap gap-4 mt-2">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-sm">Accepted</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                    <span className="text-sm">Rejected</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
                    <span className="text-sm">Undecided</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-red-500 border-dashed bg-transparent mr-2"></div>
                    <span className="text-sm">Attacker</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-green-500 border-dashed bg-transparent mr-2"></div>
                    <span className="text-sm">Defender</span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="h-[500px]">
              {framework ? (
                <ArgumentGraph
                  framework={framework}
                  semantics={selectedSemantics}
                  onFrameworkChange={handleFrameworkChange}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Database className="mx-auto h-12 w-12 mb-4" />
                    <p>No framework loaded. Please upload a file, generate a random framework, or select an example.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SemanticsPanel
            framework={framework}
            selectedSemantics={selectedSemantics}
            onSemanticsChange={setSelectedSemantics}
          />
        </div>
      </div>

      <JsonEditor
        isOpen={isJsonEditorOpen}
        onClose={() => setIsJsonEditorOpen(false)}
        onSave={(updatedFramework) => {
          setFramework(updatedFramework)
          toast({
            title: "Framework updated",
            description: "The framework has been updated successfully",
          })
        }}
        initialFramework={framework || undefined}
        key={isJsonEditorOpen ? "open" : "closed"}
      />
    </div>
  )
}
