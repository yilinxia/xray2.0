"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Upload, FileText, RefreshCw, Database, PlusCircle, Edit, Download, HelpCircle, Github, FileText as PaperIcon } from "lucide-react"
import { Icon } from '@iconify/react';
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import ArgumentGraph from "@/components/argument-graph"
import SemanticsPanel from "@/components/semantics-panel"
import JsonEditor from "@/components/json-editor"
import { generateRandomFramework, parseFrameworkFile } from "@/lib/argumentation"
import { loadExampleFrameworks } from "@/lib/load-examples"
import type { ArgumentFramework, Semantics, ExampleFramework } from "@/lib/types"

export default function ArgumentationFramework() {
  const [framework, setFramework] = useState<ArgumentFramework | null>(null)
  const [initialFramework, setInitialFramework] = useState<ArgumentFramework | null>(null)
  const [selectedSemantics, setSelectedSemantics] = useState<Semantics | null>(null)
  const [selectedExample, setSelectedExample] = useState<string>("")
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false)
  const [exampleFrameworks, setExampleFrameworks] = useState<ExampleFramework[]>([])
  const [isLoadingExamples, setIsLoadingExamples] = useState(true)
  const [currentFrameworkLabel, setCurrentFrameworkLabel] = useState<string>("")
  const [selectedExtension, setSelectedExtension] = useState<{
    accepted: string[]
    rejected: string[]
    undecided: string[]
  } | null>(null)
  const { toast } = useToast()

  // Handle extension selection from semantics panel
  const handleExtensionSelect = useCallback((accepted: string[], rejected: string[], undecided: string[]) => {
    setSelectedExtension({ accepted, rejected, undecided })
  }, [])

  // Load example frameworks on component mount
  useEffect(() => {
    const loadExamples = async () => {
      setIsLoadingExamples(true)
      try {
        const examples = await loadExampleFrameworks()
        setExampleFrameworks(examples)
      } catch (error) {
        console.error('Failed to load examples:', error)
        setExampleFrameworks([])
      } finally {
        setIsLoadingExamples(false)
      }
    }

    loadExamples()
  }, [])

  // Load an example framework when selected
  useEffect(() => {
    if (selectedExample) {
      const example = exampleFrameworks.find((ex) => ex.id === selectedExample)
      if (example) {
        setFramework(example.framework)
        setInitialFramework(example.framework)
        setCurrentFrameworkLabel(example.name)
      }
    }
  }, [selectedExample, exampleFrameworks])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsedFramework = parseFrameworkFile(text)
      setFramework(parsedFramework)
      setInitialFramework(parsedFramework)
      setSelectedExample("") // Reset example selection
      setCurrentFrameworkLabel(file.name)
      // Reset the file input
      if (event.target.form) {
        event.target.form.reset()
      }
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
    setInitialFramework(randomFramework)
    setSelectedExample("") // Reset example selection
    setCurrentFrameworkLabel("Random Framework")
  }

  // Handle framework changes (e.g., when an edge is deleted)
  const handleFrameworkChange = (newFramework: ArgumentFramework) => {
    setFramework(newFramework)
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AF-XRAY Logo" className="h-10" />
            <div>
              <h1 className="text-2xl font-bold">AF-XRAY</h1>
              <p className="text-muted-foreground text-sm">
                Argumentation Framework eXplanation, Reasoning, and AnalYsis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/yilinxia/xray2.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View on GitHub</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://dl.acm.org/doi/full/10.1145/3769126.3769246"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon icon="mdi:file-document-outline" className="h-5 w-5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Read the Paper</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="p-4 border-b bg-muted/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Input Options</h3>
            <div className="flex flex-wrap gap-2">
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

              <Button variant="outline" onClick={handleGenerateRandom}>
                <Icon icon="fluent-mdl2:generate" className="mr-2 h-4 w-4" />
                Generate Random
              </Button>

              <div className="w-full md:w-64">
                <Select
                  key={selectedExample === "" ? "reset" : selectedExample}
                  value={selectedExample}
                  onValueChange={setSelectedExample}
                >
                  <SelectTrigger className={!selectedExample ? "text-muted-foreground" : ""}>
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      <SelectValue placeholder={isLoadingExamples ? "Loading examples..." : "Select Example"} />
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
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Framework Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCreateFramework}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Framework
              </Button>

              {framework && (
                <>
                  <Button variant="outline" onClick={openJsonEditor}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Framework
                  </Button>

                  <Button variant="outline" onClick={downloadFramework}>
                    <Download className="mr-2 h-4 w-4" />
                    Download JSON
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <div className="md:col-span-1">
          <SemanticsPanel
            framework={framework}
            selectedSemantics={selectedSemantics}
            onSemanticsChange={setSelectedSemantics}
            onExtensionSelect={handleExtensionSelect}
          />
        </div>

        <div className="md:col-span-3">
          <Card className="h-full flex flex-col relative">
            <CardContent className="flex-1 p-0 relative">
              {framework ? (
                <ArgumentGraph
                  framework={framework}
                  initialFramework={initialFramework}
                  semantics={selectedSemantics}
                  onFrameworkChange={handleFrameworkChange}
                  selectedExtension={selectedExtension}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Database className="mx-auto h-12 w-12 mb-4" />
                    <p>No framework loaded. Please upload a file, generate a random framework, or select an example.</p>
                  </div>
                </div>
              )}
              {/* Overlay header with transparent background */}
              <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="text-2xl font-semibold text-gray-800 bg-white/70 px-2 py-1 rounded">Argument Graph</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="bg-white/70 rounded p-0.5">
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="max-w-xs text-sm">
                      <p>Hover over nodes to see information and hyperlinks. Click on a node to visualize how its value is calculated. Right-click to edit node properties.</p>
                    </PopoverContent>
                  </Popover>
                  {currentFrameworkLabel && (
                    <span className="text-sm font-semibold text-blue-700 bg-white/70 px-2 py-1 rounded">Current: {currentFrameworkLabel}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <JsonEditor
        isOpen={isJsonEditorOpen}
        onClose={() => setIsJsonEditorOpen(false)}
        onSave={(updatedFramework) => {
          setFramework(updatedFramework)
        }}
        initialFramework={framework || undefined}
        key={isJsonEditorOpen ? "open" : "closed"}
      />
    </div>
  )
}
