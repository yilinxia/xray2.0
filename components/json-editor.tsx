"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Save } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ArgumentFramework, Argument, Attack } from "@/lib/types"

interface JsonEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (framework: ArgumentFramework) => void
  initialFramework?: ArgumentFramework
}

export default function JsonEditor({ isOpen, onClose, onSave, initialFramework }: JsonEditorProps) {
  const [name, setName] = useState(initialFramework?.name || "My Framework")
  const [arguments_, setArguments] = useState<Argument[]>(initialFramework?.args || [])
  const [attacks, setAttacks] = useState<Attack[]>(initialFramework?.attacks || [])
  const [activeTab, setActiveTab] = useState("arguments")

  // Reset state when initialFramework changes
  useEffect(() => {
    if (initialFramework) {
      setName(initialFramework.name || "My Framework")
      setArguments(initialFramework.args || [])
      setAttacks(initialFramework.attacks || [])
    }
  }, [initialFramework])

  // Add a new argument
  const addArgument = () => {
    const newId =
      arguments_.length > 0 ? String.fromCharCode(Math.max(...arguments_.map((arg) => arg.id.charCodeAt(0))) + 1) : "A"

    setArguments([...arguments_, { id: newId, annotation: "", url: "" }])
  }

  // Remove an argument
  const removeArgument = (index: number) => {
    const newArgs = [...arguments_]
    const removedId = newArgs[index].id
    newArgs.splice(index, 1)
    setArguments(newArgs)

    // Also remove any attacks involving this argument
    setAttacks(attacks.filter((attack) => attack.from !== removedId && attack.to !== removedId))
  }

  // Update an argument
  const updateArgument = (index: number, field: keyof Argument, value: string) => {
    const newArgs = [...arguments_]
    newArgs[index] = { ...newArgs[index], [field]: value }
    setArguments(newArgs)

    // If ID changed, update attacks
    if (field === "id") {
      const oldId = arguments_[index].id
      const newId = value
      setAttacks(
        attacks.map((attack) => ({
          ...attack,
          from: attack.from === oldId ? newId : attack.from,
          to: attack.to === oldId ? newId : attack.to,
        })),
      )
    }
  }

  // Add a new attack
  const addAttack = () => {
    if (arguments_.length < 2) return

    setAttacks([
      ...attacks,
      {
        from: arguments_[0].id,
        to: arguments_[1].id,
        annotation: "",
      },
    ])
  }

  // Remove an attack
  const removeAttack = (index: number) => {
    const newAttacks = [...attacks]
    newAttacks.splice(index, 1)
    setAttacks(newAttacks)
  }

  // Update an attack
  const updateAttack = (index: number, field: keyof Attack, value: string) => {
    const newAttacks = [...attacks]
    newAttacks[index] = { ...newAttacks[index], [field]: value }
    setAttacks(newAttacks)
  }

  // Handle save
  const handleSave = () => {
    const framework: ArgumentFramework = {
      name,
      args: arguments_,
      attacks: attacks,
    }
    onSave(framework)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Argumentation Framework</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="framework-name">Framework Name</Label>
            <Input
              id="framework-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter framework name"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="arguments">Arguments ({arguments_.length})</TabsTrigger>
              <TabsTrigger value="attacks">Attacks ({attacks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="arguments" className="space-y-4">
              <Button onClick={addArgument} className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add Argument
              </Button>

              {arguments_.map((arg, index) => (
                <Card key={index} className="relative">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor={`arg-id-${index}`}>ID</Label>
                        <Input
                          id={`arg-id-${index}`}
                          value={arg.id}
                          onChange={(e) => updateArgument(index, "id", e.target.value)}
                        />
                      </div>
                      <div className="col-span-5">
                        <Label htmlFor={`arg-annotation-${index}`}>Annotation</Label>
                        <Textarea
                          id={`arg-annotation-${index}`}
                          value={arg.annotation || ""}
                          onChange={(e) => updateArgument(index, "annotation", e.target.value)}
                          placeholder="What this argument stands for"
                          className="resize-none h-20"
                        />
                      </div>
                      <div className="col-span-4">
                        <Label htmlFor={`arg-url-${index}`}>URL</Label>
                        <Input
                          id={`arg-url-${index}`}
                          value={arg.url || ""}
                          onChange={(e) => updateArgument(index, "url", e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeArgument(index)}
                          className="h-10 w-10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="attacks" className="space-y-4">
              <Button onClick={addAttack} className="flex items-center" disabled={arguments_.length < 2}>
                <Plus className="mr-2 h-4 w-4" />
                Add Attack
              </Button>

              {arguments_.length < 2 && (
                <p className="text-sm text-muted-foreground">You need at least two arguments to create attacks.</p>
              )}

              {attacks.map((attack, index) => (
                <Card key={index} className="relative">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-3">
                        <Label htmlFor={`attack-from-${index}`}>From</Label>
                        <select
                          id={`attack-from-${index}`}
                          value={attack.from}
                          onChange={(e) => updateAttack(index, "from", e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {arguments_.map((arg) => (
                            <option key={arg.id} value={arg.id}>
                              {arg.id}{" "}
                              {arg.annotation
                                ? `- ${arg.annotation.substring(0, 20)}${arg.annotation.length > 20 ? "..." : ""}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <Label htmlFor={`attack-to-${index}`}>To</Label>
                        <select
                          id={`attack-to-${index}`}
                          value={attack.to}
                          onChange={(e) => updateAttack(index, "to", e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {arguments_.map((arg) => (
                            <option key={arg.id} value={arg.id}>
                              {arg.id}{" "}
                              {arg.annotation
                                ? `- ${arg.annotation.substring(0, 20)}${arg.annotation.length > 20 ? "..." : ""}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-5">
                        <Label htmlFor={`attack-annotation-${index}`}>Annotation</Label>
                        <Input
                          id={`attack-annotation-${index}`}
                          value={attack.annotation || ""}
                          onChange={(e) => updateAttack(index, "annotation", e.target.value)}
                          placeholder="Reason for this attack"
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeAttack(index)}
                          className="h-10 w-10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex items-center">
            <Save className="mr-2 h-4 w-4" />
            Save Framework
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
