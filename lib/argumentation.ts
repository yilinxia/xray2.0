import type { ArgumentFramework, Semantics, SemanticsResult, ProvenanceInfo, JsonArgumentFramework } from "./types"

/**
 * Parse a framework file
 * Expected format:
 * arg(a).
 * arg(b).
 * att(a,b).
 */
export function parseFrameworkFile(content: string): ArgumentFramework {
  // Try to parse as JSON first
  try {
    const jsonData = JSON.parse(content)
    return parseJsonFramework(jsonData)
  } catch (e) {
    // If not JSON, try the original format
    return parseTextFramework(content)
  }
}

/**
 * Parse a JSON framework file
 */
function parseJsonFramework(jsonData: JsonArgumentFramework): ArgumentFramework {
  // Convert from the JSON format to our internal format
  return {
    name: jsonData.name,
    args: jsonData.arguments || [],
    attacks: (jsonData.defeats || []).map((defeat) => ({
      from: defeat.from,
      to: defeat.to,
      annotation: defeat.annotation,
    })),
  }
}

/**
 * Parse a text framework file
 */
function parseTextFramework(content: string): ArgumentFramework {
  const args: ArgumentFramework["args"] = []
  const attacks: ArgumentFramework["attacks"] = []

  const lines = content.split("\n")

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Parse arguments
    const argMatch = trimmedLine.match(/arg$$([^)]+)$$/)
    if (argMatch) {
      const id = argMatch[1]
      args.push({ id })
      continue
    }

    // Parse attacks
    const attMatch = trimmedLine.match(/att$$([^,]+),([^)]+)$$/)
    if (attMatch) {
      const from = attMatch[1]
      const to = attMatch[2]
      attacks.push({ from, to })
    }
  }

  return { args, attacks }
}

/**
 * Generate a random argumentation framework
 * Note: This function should only be called on the client side to avoid hydration issues
 */
export function generateRandomFramework(numArguments = 5, numAttacks = 8): ArgumentFramework {
  // Check if we're on the client side
  if (typeof window === 'undefined') {
    // Return a deterministic framework on the server to avoid hydration issues
    return {
      args: Array.from({ length: numArguments }, (_, i) => ({
        id: String.fromCharCode(65 + i), // A, B, C, ...
        annotation: `This is argument ${String.fromCharCode(65 + i)}`,
        url: `https://example.com/argument/${String.fromCharCode(65 + i)}`,
      })),
      attacks: Array.from({ length: Math.min(numAttacks, numArguments * (numArguments - 1)) }, (_, i) => {
        const fromIndex = i % numArguments
        const toIndex = (i + 1) % numArguments
        return {
          from: String.fromCharCode(65 + fromIndex),
          to: String.fromCharCode(65 + toIndex),
        }
      }),
    }
  }

  // Client-side random generation
  const args = Array.from({ length: numArguments }, (_, i) => ({
    id: String.fromCharCode(65 + i), // A, B, C, ...
    annotation: `This is argument ${String.fromCharCode(65 + i)}`,
    url: `https://example.com/argument/${String.fromCharCode(65 + i)}`,
  }))

  const attacks: ArgumentFramework["attacks"] = []
  const argIds = args.map((arg) => arg.id)

  // Generate random attacks
  for (let i = 0; i < numAttacks; i++) {
    const fromIndex = Math.floor(Math.random() * numArguments)
    let toIndex = Math.floor(Math.random() * numArguments)

    // Avoid self-attacks for simplicity
    while (toIndex === fromIndex) {
      toIndex = Math.floor(Math.random() * numArguments)
    }

    const from = argIds[fromIndex]
    const to = argIds[toIndex]

    // Check if this attack already exists
    const attackExists = attacks.some((attack) => attack.from === from && attack.to === to)

    if (!attackExists) {
      attacks.push({ from, to })
    } else {
      // Try again
      i--
    }
  }

  return { args, attacks }
}

/**
 * Compute semantics for a given framework
 * This is a simplified implementation for demonstration purposes
 */
export function computeSemantics(framework: ArgumentFramework, semantics: Semantics): SemanticsResult {
  const argIds = framework.args.map((arg) => arg.id)

  // For demonstration purposes, we'll implement a simplified version
  // In a real application, you would implement the actual semantics algorithms

  switch (semantics) {
    case "grounded":
      // Simplified grounded semantics: arguments with no attackers are accepted
      // Arguments attacked by accepted arguments are rejected
      // Everything else is undecided
      return computeGroundedSemantics(framework)

    case "preferred":
      // Simplified preferred semantics: maximize accepted arguments
      // For demo, we'll just make a slightly more optimistic version of grounded
      return computePreferredSemantics(framework)

    case "stable":
      // Simplified stable semantics: every argument is either accepted or rejected
      return computeStableSemantics(framework)

    case "complete":
      // Simplified complete semantics: similar to grounded but with more accepted arguments
      return computeCompleteSemantics(framework)

    default:
      return {
        accepted: [],
        rejected: [],
        undecided: argIds,
        provenance: Object.fromEntries(
          argIds.map((id) => [
            id,
            {
              status: "undecided" as const,
              reason: "No semantics selected",
              attackers: [],
              defenders: [],
            },
          ]),
        ),
      }
  }
}

function computeGroundedSemantics(framework: ArgumentFramework): SemanticsResult {
  const argIds = framework.args.map((arg) => arg.id)
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)

  // Arguments with no attackers are accepted
  const accepted = argIds.filter((arg) => !attackers[arg] || attackers[arg].length === 0)

  // Arguments attacked by accepted arguments are rejected
  const rejected = argIds.filter((arg) =>
    accepted.some((acc) => framework.attacks.some((att) => att.from === acc && att.to === arg)),
  )

  // Everything else is undecided
  const undecided = argIds.filter((arg) => !accepted.includes(arg) && !rejected.includes(arg))

  // Generate provenance information
  const provenance: Record<string, ProvenanceInfo> = {}

  // For accepted arguments
  accepted.forEach((arg) => {
    provenance[arg] = {
      status: "accepted",
      reason:
        attackers[arg]?.length === 0
          ? "This argument is not attacked by any other argument"
          : "All attackers of this argument are defeated",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For rejected arguments
  rejected.forEach((arg) => {
    const attackingAccepted = accepted.filter((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    provenance[arg] = {
      status: "rejected",
      reason: `This argument is attacked by accepted argument(s): ${attackingAccepted.join(", ")}`,
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For undecided arguments
  undecided.forEach((arg) => {
    provenance[arg] = {
      status: "undecided",
      reason: "This argument is involved in a cycle or attacked by undecided arguments",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  return { accepted, rejected, undecided, provenance }
}

function computePreferredSemantics(framework: ArgumentFramework): SemanticsResult {
  // Start with grounded semantics as a base
  const grounded = computeGroundedSemantics(framework)

  // For demonstration, we'll make a slightly more optimistic version
  // In a real implementation, you would compute all maximal admissible sets

  // Move some undecided arguments to accepted if they don't attack each other
  const newAccepted = [...grounded.accepted]
  const newUndecided: string[] = []

  for (const arg of grounded.undecided) {
    // Check if arg is attacked by any currently accepted argument
    const isAttackedByAccepted = newAccepted.some((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    // Check if arg attacks any currently accepted argument
    const attacksAccepted = newAccepted.some((acc) =>
      framework.attacks.some((att) => att.from === arg && att.to === acc),
    )

    if (!isAttackedByAccepted && !attacksAccepted) {
      newAccepted.push(arg)
    } else {
      newUndecided.push(arg)
    }
  }

  // Arguments attacked by accepted arguments are rejected
  const newRejected = framework.args
    .map((arg) => arg.id)
    .filter(
      (arg) =>
        !newAccepted.includes(arg) &&
        newAccepted.some((acc) => framework.attacks.some((att) => att.from === acc && att.to === arg)),
    )

  const finalUndecided = newUndecided.filter((arg) => !newRejected.includes(arg))

  // Generate provenance information
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)
  const provenance: Record<string, ProvenanceInfo> = {}

  // For accepted arguments
  newAccepted.forEach((arg) => {
    const wasGroundedAccepted = grounded.accepted.includes(arg)

    provenance[arg] = {
      status: "accepted",
      reason: wasGroundedAccepted
        ? "This argument is not attacked by any other argument"
        : "This argument is defended and can be included in a preferred extension",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For rejected arguments
  newRejected.forEach((arg) => {
    const attackingAccepted = newAccepted.filter((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    provenance[arg] = {
      status: "rejected",
      reason: `This argument is attacked by accepted argument(s): ${attackingAccepted.join(", ")}`,
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For undecided arguments
  finalUndecided.forEach((arg) => {
    provenance[arg] = {
      status: "undecided",
      reason: "This argument cannot be included in the current preferred extension due to conflicts",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  return {
    accepted: newAccepted,
    rejected: newRejected,
    undecided: finalUndecided,
    provenance,
  }
}

function computeStableSemantics(framework: ArgumentFramework): SemanticsResult {
  // For demonstration, we'll create a stable extension where every argument is either accepted or rejected
  // In a real implementation, you would compute all stable extensions

  const preferred = computePreferredSemantics(framework)
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)

  // In stable semantics, there are no undecided arguments
  // We'll move all undecided arguments to rejected for simplicity

  const provenance = { ...preferred.provenance }

  // Update provenance for formerly undecided arguments
  preferred.undecided.forEach((arg) => {
    provenance[arg] = {
      status: "rejected",
      reason: "In stable semantics, this argument is rejected because it's not in the extension",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  return {
    accepted: preferred.accepted,
    rejected: [...preferred.rejected, ...preferred.undecided],
    undecided: [],
    provenance,
  }
}

function computeCompleteSemantics(framework: ArgumentFramework): SemanticsResult {
  // Complete semantics is between grounded and preferred
  // For demonstration, we'll use a mix of both

  const grounded = computeGroundedSemantics(framework)
  const preferred = computePreferredSemantics(framework)
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)

  // Take half of the arguments that are accepted in preferred but not in grounded
  const extraAccepted = preferred.accepted
    .filter((arg) => !grounded.accepted.includes(arg))
    .slice(0, Math.floor(preferred.accepted.length / 2))

  const newAccepted = [...grounded.accepted, ...extraAccepted]

  // Arguments attacked by accepted arguments are rejected
  const newRejected = framework.args
    .map((arg) => arg.id)
    .filter(
      (arg) =>
        !newAccepted.includes(arg) &&
        newAccepted.some((acc) => framework.attacks.some((att) => att.from === acc && att.to === arg)),
    )

  // Everything else is undecided
  const newUndecided = framework.args
    .map((arg) => arg.id)
    .filter((arg) => !newAccepted.includes(arg) && !newRejected.includes(arg))

  // Generate provenance information
  const provenance: Record<string, ProvenanceInfo> = {}

  // For accepted arguments
  newAccepted.forEach((arg) => {
    const wasGroundedAccepted = grounded.accepted.includes(arg)

    provenance[arg] = {
      status: "accepted",
      reason: wasGroundedAccepted
        ? "This argument is not attacked by any other argument"
        : "This argument is defended and included in this complete extension",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For rejected arguments
  newRejected.forEach((arg) => {
    const attackingAccepted = newAccepted.filter((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    provenance[arg] = {
      status: "rejected",
      reason: `This argument is attacked by accepted argument(s): ${attackingAccepted.join(", ")}`,
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  // For undecided arguments
  newUndecided.forEach((arg) => {
    provenance[arg] = {
      status: "undecided",
      reason: "This argument is neither accepted nor rejected in this complete extension",
      attackers: attackers[arg] || [],
      defenders: defenders[arg] || [],
      potentialProvenance: attackers[arg] || [],
      primaryProvenance: defenders[arg] || [],
      actualProvenance: [...(attackers[arg] || []), ...(defenders[arg] || [])],
    }
  })

  return {
    accepted: newAccepted,
    rejected: newRejected,
    undecided: newUndecided,
    provenance,
  }
}

// Helper function to get all attackers for each argument
function getAttackers(framework: ArgumentFramework): Record<string, string[]> {
  const attackers: Record<string, string[]> = {}

  // Initialize empty arrays for all arguments
  framework.args.forEach((arg) => {
    attackers[arg.id] = []
  })

  // Fill in attackers
  framework.attacks.forEach((attack) => {
    if (!attackers[attack.to]) {
      attackers[attack.to] = []
    }
    attackers[attack.to].push(attack.from)
  })

  return attackers
}

// Helper function to get all defenders for each argument
function getDefenders(framework: ArgumentFramework, attackers: Record<string, string[]>): Record<string, string[]> {
  const defenders: Record<string, string[]> = {}

  // Initialize empty arrays for all arguments
  framework.args.forEach((arg) => {
    defenders[arg.id] = []
  })

  // For each argument, find its defenders
  // A defender of A is any argument that attacks an attacker of A
  framework.args.forEach((arg) => {
    const argAttackers = attackers[arg.id] || []

    // For each attacker of this argument
    argAttackers.forEach((attacker) => {
      // Find arguments that attack this attacker
      const defenderIds = framework.attacks.filter((att) => att.to === attacker).map((att) => att.from)

      defenders[arg.id].push(...defenderIds)
    })

    // Remove duplicates
    defenders[arg.id] = [...new Set(defenders[arg.id])]
  })

  return defenders
}

// Import example frameworks from a separate file
import { exampleFrameworks } from "./example-frameworks"
export { exampleFrameworks }
