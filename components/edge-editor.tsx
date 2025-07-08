"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"
import type { Attack } from "@/lib/types"

interface EdgeEditorProps {
    isOpen: boolean
    onClose: () => void
    onSave: (updatedEdge: Attack) => void
    edge: Attack | null
}

export default function EdgeEditor({ isOpen, onClose, onSave, edge }: EdgeEditorProps) {
    if (!edge) return null

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        const updatedEdge: Attack = {
            from: edge.from,
            to: edge.to,
            annotation: (formData.get("annotation") as string) || "",
        }

        onSave(updatedEdge)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Edge {edge.from} → {edge.to}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="annotation">Annotation</Label>
                        <Textarea
                            id="annotation"
                            name="annotation"
                            defaultValue={edge.annotation || ""}
                            placeholder="Description of this attack relationship"
                            className="resize-none h-24"
                        />
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