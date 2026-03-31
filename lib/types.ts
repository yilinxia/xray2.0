// Types for the argumentation framework

export interface Argument {
  id: string
  annotation?: string
  url?: string
  value?: "accepted" | "defeated" | "undecided"
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

// Single extension result
export interface Extension {
  members: string[]
  isStable?: boolean  // For preferred semantics, indicates if this extension is also stable
}

export interface SemanticsResult {
  accepted: string[]
  rejected: string[]
  undecided: string[]
  provenance: Record<string, ProvenanceInfo>
  // For semantics with multiple extensions
  extensions?: Extension[]
  // For complete semantics
  groundedExtension?: string[]
  stableExtensions?: Extension[]
  preferredNonStableExtensions?: Extension[]
  otherCompleteExtensions?: Extension[]
}

export interface ProvenanceInfo {
  status: "accepted" | "rejected" | "undecided"
  reason: string
  attackers: string[]
  defenders: string[]
  potentialProvenance?: string[]
  primaryProvenance?: string[]
  actualProvenance?: string[]
  length?: number // Game-theoretic length (0, 2, 4... for accepted; 1, 3, 5... for defeated; Infinity for undefined)
}

export interface ExampleFramework {
  id: string
  name: string
  framework: ArgumentFramework
}
