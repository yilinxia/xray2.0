import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import type { ProvenanceInfo, Argument } from "@/lib/types"

interface ProvenanceModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
  provenance: ProvenanceInfo | null
  argument: Argument | null
}

export default function ProvenanceModal({ isOpen, onClose, nodeId, provenance, argument }: ProvenanceModalProps) {
  if (!nodeId || !provenance || !argument) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "undecided":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Argument {nodeId}</span>
            <Badge className={getStatusColor(provenance.status)}>{provenance.status}</Badge>
          </DialogTitle>
          <DialogDescription>{argument.description || `Information about argument ${nodeId}`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Provenance</h3>
            <p className="text-sm text-muted-foreground">{provenance.reason}</p>
          </div>

          {provenance.attackers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-1">Attackers</h3>
              <div className="flex flex-wrap gap-1">
                {provenance.attackers.map((attacker) => (
                  <Badge key={attacker} variant="outline">
                    {attacker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {provenance.defenders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-1">Defenders</h3>
              <div className="flex flex-wrap gap-1">
                {provenance.defenders.map((defender) => (
                  <Badge key={defender} variant="outline">
                    {defender}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {argument.url && (
            <div>
              <h3 className="text-sm font-medium mb-1">External Link</h3>
              <a
                href={argument.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center"
              >
                View detailed information <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
