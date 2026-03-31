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
import TutorialGraph from "@/components/tutorial-graph"
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

  const handleExtensionSelect = useCallback((accepted: string[], rejected: string[], undecided: string[]) => {
    setSelectedExtension({ accepted, rejected, undecided })
  }, [])

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsedFramework = parseFrameworkFile(text)
      setFramework(parsedFramework)
      setInitialFramework(parsedFramework)
      setSelectedExample("")
      setCurrentFrameworkLabel(file.name)
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

  const handleGenerateRandom = () => {
    const randomFramework = generateRandomFramework(5, 8)
    setFramework(randomFramework)
    setInitialFramework(randomFramework)
    setSelectedExample("")
    setCurrentFrameworkLabel("Random Framework")
  }

  const handleFrameworkChange = (newFramework: ArgumentFramework) => {
    setFramework(newFramework)
  }

  const openJsonEditor = () => {
    setIsJsonEditorOpen(true)
  }

  const handleCreateFramework = () => {
    setIsJsonEditorOpen(true)
  }

  const downloadFramework = () => {
    if (!framework) return
    const jsonData = {
      name: framework.name || "Argumentation Framework",
      arguments: framework.args,
      defeats: framework.attacks,
    }
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
    <div className="min-h-screen flex flex-col">
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
      <div className="h-[600px] grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
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

      {/* Tutorial Section */}
      <div className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-8 py-16">
          
          {/* What is an Argumentation Framework? */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">What is an Argumentation Framework?</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              An <strong className="text-foreground">argumentation framework (AF)</strong> is a directed graph where nodes represent abstract arguments and edges represent attacks between them. AFs provide formal approaches for representing and reasoning about conflict, with applications in case law, medical decision making, and multi-agent systems.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              When argument B attacks argument A (written B→A), accepting B gives us reason to reject A. The goal is to find sets of arguments that are <strong className="text-foreground">conflict-free</strong> (don't attack each other) and <strong className="text-foreground">defend each other</strong> against outside attacks.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Let's explore this with the <strong className="text-foreground">Wild Animals</strong> case, modeling the famous 1805 legal dispute{" "}
              <a href="https://en.wikipedia.org/wiki/Pierson_v._Post" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Pierson v. Post</a>: 
              if you're chasing a fox and someone else captures it, who owns the fox? This example is from Bench-Capon's work on{" "}
              <a href="https://jurix.nl/pdf/j02-11.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">representing case law as argumentation frameworks</a>.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              The core dispute: argument A claims "Pursuer had right to animal", but B counters "Pursuer not in possession":
            </p>
            
            <TutorialGraph 
              dot={`digraph {
                rankdir=LR
                node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7]
                A [label="A"]
                B [label="B"]
                B -> A
              }`}
              caption="B (Not in possession) attacks A (Had right to animal)"
            />

            <p className="text-muted-foreground mb-4 leading-relaxed">
              But the debate doesn't stop there. K ("Animal was mortally wounded") and L ("Bodily seizure not necessary") both attack I ("Pursuit not enough"), which in turn attacks B:
            </p>

            <TutorialGraph 
              dot={`digraph {
                rankdir=LR
                node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7]
                A B I K L
                B -> A
                I -> B [dir=back]
                K -> I
                L -> I
              }`}
              caption="K and L attack I, which attacks B, which attacks A"
            />

            <p className="text-muted-foreground leading-relaxed">
              Select <strong className="text-foreground">"wild_animals"</strong> from the examples dropdown above to load the full framework with all 24 arguments.
            </p>
          </section>

          {/* Semantics */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">How Do We Decide Which Arguments Win?</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Given an AF, the main reasoning task is to determine which arguments to accept. This is where <strong className="text-foreground">semantics</strong> come in — rules that define what it means for arguments to be "rationally acceptable" together.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              After selecting a semantics, arguments are labeled by status:
            </p>
            <div className="flex gap-6 justify-center py-4 mb-6 bg-background rounded-lg border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#40cfff] flex items-center justify-center text-white text-xs font-bold shadow-sm">IN</div>
                <span className="text-sm">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ffb763] flex items-center justify-center text-white text-xs font-bold shadow-sm">OUT</div>
                <span className="text-sm">Defeated</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#fefe62] flex items-center justify-center text-gray-700 text-xs font-bold shadow-sm">UND</div>
                <span className="text-sm">Undecided</span>
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <div className="p-4 bg-background rounded-lg border">
                <h4 className="font-semibold mb-2">Grounded Semantics (Skeptical)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The most cautious approach. An argument is <strong>accepted</strong> if all its attackers are defeated. An argument is <strong>defeated</strong> if it has an accepted attacker. Arguments that are neither are <strong>undecided</strong>. This yields a unique 3-valued solution.
                </p>
                <TutorialGraph 
                  dot={`digraph {
                    rankdir=LR
                    node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7 style=filled]
                    K [label="K.0" fillcolor="#40cfff"]
                    L [label="L.0" fillcolor="#40cfff"]
                    I [label="I.1" fillcolor="#ffb763"]
                    K -> I
                    L -> I
                  }`}
                  caption="K.0 and L.0 are accepted (length 0, no attackers). I.1 is defeated (length 1)."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  The number after each argument is its <strong>length</strong> — the number of argumentation rounds needed to determine its status.
                </p>
              </div>

              <div className="p-4 bg-background rounded-lg border">
                <h4 className="font-semibold mb-2">When Arguments Form Cycles: Ambiguity</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  In the Wild Animals case, M ("Mere pursuit not enough") and O ("Bodily seizure not necessary") attack each other. Under grounded semantics, both remain undecided — the AF is <strong>ambiguous</strong>:
                </p>
                <TutorialGraph 
                  dot={`digraph {
                    rankdir=LR
                    node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7 style=filled]
                    M [label="M" fillcolor="#fefe62"]
                    O [label="O" fillcolor="#fefe62"]
                    M -> O
                    O -> M
                  }`}
                  caption="M and O attack each other — both undecided under grounded semantics"
                />
              </div>

              <div className="p-4 bg-background rounded-lg border">
                <h4 className="font-semibold mb-2">Stable Semantics (Credulous)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Resolves ambiguity by requiring every argument to be either accepted or defeated. This often produces multiple <strong>extensions</strong>, each representing a coherent position:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <TutorialGraph 
                    dot={`digraph {
                      rankdir=LR
                      node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7 style=filled]
                      M [label="M" fillcolor="#40cfff"]
                      O [label="O" fillcolor="#ffb763"]
                      M -> O
                      O -> M
                    }`}
                    caption="S1: M accepted, O defeated"
                  />
                  <TutorialGraph 
                    dot={`digraph {
                      rankdir=LR
                      node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7 style=filled]
                      M [label="M" fillcolor="#ffb763"]
                      O [label="O" fillcolor="#40cfff"]
                      M -> O
                      O -> M
                    }`}
                    caption="S2: O accepted, M defeated"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These represent the two opposing legal positions in Pierson v. Post!
                </p>
              </div>

              <div className="p-4 bg-background rounded-lg border">
                <h4 className="font-semibold mb-2">Preferred & Complete Semantics</h4>
                <p className="text-sm text-muted-foreground">
                  Preferred finds the largest defensible sets. Complete shows all positions from minimal (grounded) to maximal (preferred).
                </p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              Try switching between semantics in the tool above to see how the Wild Animals framework changes.
            </p>
          </section>

          {/* Provenance */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Understanding Why: Provenance and Length</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Knowing that an argument is accepted or defeated is useful, but understanding <em>why</em> is even more valuable. <strong className="text-foreground">Provenance</strong> traces the reasoning chain that determines an argument's status. The grounded semantics is "self-explanatory" — each argument's status can be derived from the arguments below it.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              AF-XRAY uses a <strong className="text-foreground">layered visualization</strong> based on argument <strong className="text-foreground">length</strong> — the number of argumentation rounds needed to determine status:
            </p>

            <TutorialGraph 
              dot={`digraph {
                rankdir=LR
                node [fontname="helvetica" shape=circle fixedsize=true width=0.25 height=0.25 fontsize=7 style=filled]
                K [label="K.0" fillcolor="#40cfff"]
                I [label="I.1" fillcolor="#ffb763"]
                B [label="B.2" fillcolor="#40cfff"]
                A [label="A.3" fillcolor="#ffb763"]
                K -> I
                I -> B [dir=back]
                B -> A
              }`}
              caption="Layered by length: K.0 (no attackers) → I.1 (defeated by K) → B.2 (survives) → A.3 (defeated by B)"
            />

            <p className="text-muted-foreground mb-6 leading-relaxed">
              Arguments at length 0 have no attackers. Each subsequent layer depends on the layers below. This makes the derivation structure explicit and "self-explanatory."
            </p>
            
            <p className="text-muted-foreground mb-4 leading-relaxed">
              AF-XRAY also classifies <strong className="text-foreground">attack types</strong> by their semantic role:
            </p>
            
            <div className="space-y-3 mb-8">
              <div className="p-3 bg-background rounded-lg border border-l-4 border-l-blue-500">
                <h4 className="font-semibold text-sm mb-1">Primary Attack (solid blue)</h4>
                <p className="text-xs text-muted-foreground">
                  A winning attack that is part of the shortest path to defeat — the essential attack.
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-l-4 border-l-blue-300">
                <h4 className="font-semibold text-sm mb-1">Secondary Attack (dashed blue)</h4>
                <p className="text-xs text-muted-foreground">
                  A winning attack that is redundant — the target was already defeated by a shorter path.
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-l-4 border-l-gray-400">
                <h4 className="font-semibold text-sm mb-1">Blunder (dotted gray)</h4>
                <p className="text-xs text-muted-foreground">
                  An irrelevant attack — it doesn't affect the argument's status (e.g., a defeated argument attacking an accepted one).
                </p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              Click on any argument in the tool above to see its provenance highlighted.
            </p>
          </section>

          {/* Critical Attacks */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Critical Attacks: Explaining Stable Solutions</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              How can we explain why a stable solution chose one resolution over another? The key insight is that stable solutions involve <strong className="text-foreground">choices</strong> — assumptions about which arguments to accept when the grounded semantics leaves them undecided.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              A <strong className="text-foreground">critical attack set</strong> is a minimal set of edges that, if temporarily suspended (ignored), would make the stable solution derivable as a grounded solution. These attacks pinpoint the exact choices made.
            </p>

            <TutorialGraph 
              dot={`digraph {
                rankdir=LR
                node [fontname="helvetica" shape=circle fixedsize=true width=0.2 height=0.2 fontsize=7 style=filled]
                M [label="M" fillcolor="#40cfff"]
                O [label="O" fillcolor="#ffb763"]
                M -> O [color="#1c72d4"]
                O -> M [color="red" style=dashed penwidth=1.5]
              }`}
              caption="S1: Critical attack O→M (red dashed). Suspending it makes M accepted via grounded semantics."
            />

            <p className="text-muted-foreground mb-4 leading-relaxed">
              In the Wild Animals case, the mutual attack between M ("Mere pursuit not enough") and O ("Bodily seizure not necessary") creates ambiguity. The two stable solutions have critical attack sets:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-sm font-semibold mb-1">Solution S1: M accepted</p>
                <p className="text-xs text-muted-foreground">Critical attack: {"{O→M}"}</p>
                <p className="text-xs text-muted-foreground mt-1">Suspending O→M lets M be accepted (no attackers), defeating O.</p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-sm font-semibold mb-1">Solution S2: O accepted</p>
                <p className="text-xs text-muted-foreground">Critical attack: {"{M→O}"}</p>
                <p className="text-xs text-muted-foreground mt-1">Suspending M→O lets O be accepted (no attackers), defeating M.</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4 leading-relaxed">
              This supports <strong className="text-foreground">teleological legal reasoning</strong>: different assumptions lead to different legally justified conclusions. In Pierson v. Post, accepting M (mere pursuit not enough) or O (bodily seizure not necessary) reflects opposing legal positions about property rights.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Select Stable semantics and click on an argument to see critical attacks highlighted in red.
            </p>
          </section>

          {/* Interactive Features */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Interactive Features</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              AF-XRAY is designed for exploration. Here are the key ways you can interact with the visualization:
            </p>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">1.</span>
                <span><strong className="text-foreground">Hover</strong> over nodes to see argument details and any associated hyperlinks.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">2.</span>
                <span><strong className="text-foreground">Click</strong> a node to select it and view its provenance — how its status is determined.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">3.</span>
                <span><strong className="text-foreground">Right-click</strong> a node to edit its properties or add/remove attacks.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">4.</span>
                <span><strong className="text-foreground">Drag</strong> nodes to rearrange the graph layout.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">5.</span>
                <span>Use the <strong className="text-foreground">Edit Framework</strong> button to modify arguments and attacks via JSON.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground shrink-0">6.</span>
                <span><strong className="text-foreground">Download</strong> your modified framework to save your work.</span>
              </li>
            </ol>
          </section>

          {/* Closing */}
          <section className="text-center p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-xl border">
            <h3 className="text-xl font-bold mb-4">Start Exploring</h3>
            <p className="text-muted-foreground leading-relaxed">
              You now have the tools to analyze argumentation frameworks: load or create frameworks, evaluate them under different semantics, trace provenance to understand outcomes, and identify critical attacks. Scroll back up to experiment with the Wild Animals case, or load other examples to see how these concepts apply across different domains.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-6">
        <div className="max-w-5xl mx-auto px-8 text-center text-sm text-muted-foreground">
          <p>
            Released under MIT License and built upon{" "}
            <a href="https://pyarg.npai.science.uu.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PyArg</a>.
          </p>
          <p className="mt-1">
            Copyright © 2025-Present.{" "}
            <a href="https://cirss.ischool.illinois.edu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              University of Illinois Urbana-Champaign CIRSS
            </a>.
          </p>
        </div>
      </footer>

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