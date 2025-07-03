"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"
import type { Argument } from "@/lib/types"

interface NodeEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (updatedNode: Argument) => void
  node: Argument | null
}

export default function NodeEditor({ isOpen, onClose, onSave, node }: NodeEditorProps) {
  if (!node) return null

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const updatedNode: Argument = {
      id: node.id,
      annotation: (formData.get("annotation") as string) || "",
      url: (formData.get("url") as string) || "",
    }

    onSave(updatedNode)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Argument {node.id}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="annotation">Annotation</Label>
            <Textarea
              id="annotation"
              name="annotation"
              defaultValue={node.annotation || ""}
              placeholder="What this argument stands for"
              className="resize-none h-24"
            />
          </div>

          <div>
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" defaultValue={node.url || ""} placeholder="https://example.com" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex items-center">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
