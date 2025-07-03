// Types for the argumentation framework

export interface Argument {
  id: string
  annotation?: string
  url?: string
}

export interface Attack {
  from: string
  to: string
  annotation?: string
}

// For compatibility with existing code
export interface ArgumentFramework {
  name?: string
  args: Argument[]
  attacks: Attack[]
}

// For the new JSON format
export interface JsonArgumentFramework {
  name: string
  arguments: Argument[]
  defeats: Attack[]
}

export type Semantics = "grounded" | "preferred" | "stable" | "complete"

export type ProvenanceType = "potential" | "primary" | "actual"

export interface SemanticsResult {
  accepted: string[]
  rejected: string[]
  undecided: string[]
  provenance: Record<string, ProvenanceInfo>
}

export interface ProvenanceInfo {
  status: "accepted" | "rejected" | "undecided"
  reason: string
  attackers: string[]
  defenders: string[]
  potentialProvenance?: string[]
  primaryProvenance?: string[]
  actualProvenance?: string[]
}

export interface ExampleFramework {
  id: string
  name: string
  framework: ArgumentFramework
}
