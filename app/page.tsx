"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload, FileText, RefreshCw, Database, PlusCircle, Edit, Download } from "lucide-react"
import { Icon } from '@iconify/react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import ArgumentGraph from "@/components/argument-graph"
import SemanticsPanel from "@/components/semantics-panel"
import JsonEditor from "@/components/json-editor"
import { generateRandomFramework, parseFrameworkFile } from "@/lib/argumentation"
import { loadExampleFrameworks } from "@/lib/load-examples"
import type { ArgumentFramework, Semantics, ExampleFramework } from "@/lib/types"

export default function ArgumentationFramework() {
  const [framework, setFramework] = useState<ArgumentFramework | null>(null)
  const [initialFramework, setInitialFramework] = useState<ArgumentFramework | null>(null)
  const [selectedSemantics, setSelectedSemantics] = useState<Semantics>("grounded")
  const [selectedExample, setSelectedExample] = useState<string>("")
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false)
  const [exampleFrameworks, setExampleFrameworks] = useState<ExampleFramework[]>([])
  const [isLoadingExamples, setIsLoadingExamples] = useState(true)
  const [currentFrameworkLabel, setCurrentFrameworkLabel] = useState<string>("")
  const { toast } = useToast()

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
        <h1 className="text-2xl font-bold">Argumentation Framework Visualizer</h1>
        <p className="text-muted-foreground">
          Upload, generate, or select an example to visualize arguments and attack relationships
        </p>
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
          />
        </div>

        <div className="md:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle>Argument Graph</CardTitle>
              <CardDescription>
                Hover over nodes to see information and hyperlinks. Click on a node to visualize how its value is
                calculated. Right-click to edit node properties.
              </CardDescription>
              {currentFrameworkLabel && (
                <div className="mt-2 text-sm font-semibold text-blue-700">Current: {currentFrameworkLabel}</div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {framework ? (
                <ArgumentGraph
                  framework={framework}
                  initialFramework={initialFramework}
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
