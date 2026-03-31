import type { ArgumentFramework, Semantics, SemanticsResult, ProvenanceInfo, Extension } from "./types"
import {
  LENGTH_CAL_ENCODING,
  STABLE_ENCODING,
  PREFERRED_ENCODING,
  COMPLETE_ENCODING,
} from "./encodings"

// Type for clingo-wasm result
interface ClingoResult {
  Result: "SATISFIABLE" | "UNSATISFIABLE" | "UNKNOWN" | "OPTIMUM FOUND"
  Call: {
    Witnesses: {
      Value: string[]
    }[]
  }[]
}

interface ClingoError {
  Result: "ERROR"
  Error: string
}

// Lazy-load clingo-wasm to avoid issues during SSR
let clingoInitialized = false
let clingoRunPromise: Promise<any> | null = null

// Mutex to prevent concurrent clingo runs
let clingoRunning = false
let clingoQueue: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  program: string
  numModels: number
}> = []

async function getClingoRun() {
  if (!clingoRunPromise) {
    clingoRunPromise = import("clingo-wasm").then(async (module) => {
      // Initialize clingo with the WASM file from public directory
      if (!clingoInitialized) {
        try {
          // Get the full URL for the WASM file (workers need absolute URLs)
          const wasmUrl = typeof window !== "undefined"
            ? `${window.location.origin}/clingo/clingo.wasm`
            : "/clingo/clingo.wasm"

          console.log("Initializing clingo with WASM URL:", wasmUrl)
          await module.init(wasmUrl)
          clingoInitialized = true
          console.log("Clingo initialized successfully")
        } catch (error) {
          console.error("Failed to initialize clingo with custom WASM path:", error)
          // Try without custom path as fallback (will use default from node_modules)
          console.log("Attempting to use default clingo WASM...")
        }
      }
      
      // Return a wrapped run function that serializes calls
      const originalRun = module.run
      return async (program: string, numModels: number) => {
        return new Promise((resolve, reject) => {
          clingoQueue.push({ resolve, reject, program, numModels })
          processQueue(originalRun)
        })
      }
    })
  }
  return clingoRunPromise
}

async function processQueue(run: any) {
  if (clingoRunning || clingoQueue.length === 0) {
    return
  }
  
  clingoRunning = true
  const { resolve, reject, program, numModels } = clingoQueue.shift()!
  
  try {
    console.log("[processQueue] Running clingo...")
    const result = await run(program, numModels)
    console.log("[processQueue] Clingo completed")
    resolve(result)
  } catch (error) {
    console.error("[processQueue] Clingo error:", error)
    reject(error)
  } finally {
    clingoRunning = false
    // Process next item in queue
    if (clingoQueue.length > 0) {
      processQueue(run)
    }
  }
}

/**
 * Convert an argument ID to a safe ASP identifier (lowercase)
 * ASP treats uppercase identifiers as variables, so we need to convert to lowercase
 */
function toASPId(id: string): string {
  // Convert to lowercase and replace any non-alphanumeric characters with underscores
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_')
}

/**
 * Create a mapping from ASP IDs back to original IDs
 */
function createIdMapping(framework: ArgumentFramework): { toASP: Map<string, string>, fromASP: Map<string, string> } {
  const toASP = new Map<string, string>()
  const fromASP = new Map<string, string>()
  
  for (const arg of framework.args) {
    const aspId = toASPId(arg.id)
    toASP.set(arg.id, aspId)
    fromASP.set(aspId, arg.id)
  }
  
  return { toASP, fromASP }
}

/**
 * Convert argument framework to ASP facts
 * @param useAttackFormat - If true, use attack(X,Y) format, otherwise use att(X,Y)
 */
function frameworkToASP(framework: ArgumentFramework, useAttackFormat = false): string {
  const facts: string[] = []
  const { toASP } = createIdMapping(framework)

  if (useAttackFormat) {
    // For length_cal encoding, only need attack facts (pos is derived)
    for (const attack of framework.attacks) {
      const fromASP = toASP.get(attack.from) || toASPId(attack.from)
      const toASPId2 = toASP.get(attack.to) || toASPId(attack.to)
      facts.push(`attack(${fromASP},${toASPId2}).`)
    }
  } else {
    // Standard format with arg and att
    // Add argument facts
    for (const arg of framework.args) {
      const aspId = toASP.get(arg.id) || toASPId(arg.id)
      facts.push(`arg(${aspId}).`)
    }

    // Add attack facts
    for (const attack of framework.attacks) {
      const fromASP = toASP.get(attack.from) || toASPId(attack.from)
      const toASPId2 = toASP.get(attack.to) || toASPId(attack.to)
      facts.push(`att(${fromASP},${toASPId2}).`)
    }
  }

  return facts.join("\n")
}

/**
 * Extract extensions from clingo result
 * Returns all extensions found (for semantics that can have multiple extensions)
 * @param idMapping - Optional mapping from ASP IDs back to original IDs
 */
function extractExtensions(result: ClingoResult | ClingoError, idMapping?: Map<string, string>): Set<string>[] {
  if ("Error" in result) {
    console.error("Clingo error:", result.Error)
    return []
  }

  const extensions: Set<string>[] = []

  // Iterate through all calls and witnesses
  for (const call of result.Call || []) {
    for (const witness of call.Witnesses || []) {
      const extension = new Set<string>()

      // Look for in(X) atoms in the witness values
      for (const atom of witness.Value || []) {
        // Parse atoms like "in(a)" to extract the argument id
        const match = atom.match(/^in\((.+)\)$/)
        if (match) {
          const aspId = match[1]
          // Convert back to original ID if mapping provided
          const originalId = idMapping ? (idMapping.get(aspId) || aspId) : aspId
          extension.add(originalId)
        }
      }

      extensions.push(extension)
    }
  }

  return extensions
}

/**
 * Extract length-based results from clingo (for grounded with length_cal encoding)
 * Returns {accepted, defeated, undefined} with length information
 * @param idMapping - Optional mapping from ASP IDs back to original IDs
 */
function extractLengthResults(result: ClingoResult | ClingoError, idMapping?: Map<string, string>): {
  accepted: Map<string, number>
  defeated: Map<string, number>
  undefined: Set<string>
} {
  const accepted = new Map<string, number>()
  const defeated = new Map<string, number>()
  const undefined = new Set<string>()

  if ("Error" in result) {
    console.error("Clingo error:", result.Error)
    return { accepted, defeated, undefined }
  }

  // Iterate through all calls and witnesses
  for (const call of result.Call || []) {
    for (const witness of call.Witnesses || []) {
      // Look for len(Status,Arg,Length) atoms
      for (const atom of witness.Value || []) {
        // Parse atoms like "len(accepted,a,0)", "len(defeated,b,1)", "len(undefined,c,infinity)"
        const match = atom.match(/^len\((\w+),(\w+),(.+)\)$/)
        if (match) {
          const [, status, aspId, lengthStr] = match
          // Convert back to original ID if mapping provided
          const originalId = idMapping ? (idMapping.get(aspId) || aspId) : aspId

          if (status === "accepted") {
            const length = parseInt(lengthStr, 10)
            accepted.set(originalId, length)
          } else if (status === "defeated") {
            const length = parseInt(lengthStr, 10)
            defeated.set(originalId, length)
          } else if (status === "undefined") {
            undefined.add(originalId)
          }
        }
      }
    }
  }

  return { accepted, defeated, undefined }
}

/**
 * Compute semantics using clingo-wasm
 */
export async function computeSemanticsWithClingo(
  framework: ArgumentFramework,
  semantics: Semantics,
): Promise<SemanticsResult> {
  console.log("[computeSemanticsWithClingo] Starting for semantics:", semantics)
  try {
    // Get clingo run function
    const run = await getClingoRun()
    console.log("[computeSemanticsWithClingo] Got clingo run function")

    // For grounded semantics, use length_cal encoding
    if (semantics === "grounded") {
      console.log("[computeSemanticsWithClingo] Calling computeGroundedWithLength...")
      const groundedResult = await computeGroundedWithLength(framework, run)
      console.log("[computeSemanticsWithClingo] Got grounded result:", groundedResult)
      console.log("[computeSemanticsWithClingo] Returning grounded result NOW")
      return groundedResult
    }

    // For stable semantics
    if (semantics === "stable") {
      return await computeStableSemantics(framework, run)
    }

    // For preferred semantics
    if (semantics === "preferred") {
      return await computePreferredSemantics(framework, run)
    }

    // For complete semantics
    if (semantics === "complete") {
      return await computeCompleteSemantics(framework, run)
    }

    throw new Error(`Unknown semantics: ${semantics}`)
  } catch (error) {
    console.error("Error computing semantics with clingo:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace")
    // Fallback to empty result if clingo fails
    return createEmptyResult(framework)
  }
}

/**
 * Compute stable semantics - returns all stable extensions
 */
async function computeStableSemantics(
  framework: ArgumentFramework,
  run: any,
): Promise<SemanticsResult> {
  console.log("Computing stable semantics...")

  const { fromASP } = createIdMapping(framework)
  const facts = frameworkToASP(framework, false)
  const program = facts + "\n" + STABLE_ENCODING
  const result = await run(program, 0)

  const extensionSets = extractExtensions(result, fromASP)
  console.log("Stable extensions found:", extensionSets.length)

  if (extensionSets.length === 0) {
    return createEmptyResult(framework)
  }

  // Convert to Extension objects
  const extensions: Extension[] = extensionSets.map(ext => ({
    members: Array.from(ext).sort(),
    isStable: true
  }))

  // Use first extension for default coloring
  const firstExtension = extensions[0].members
  const allArgs = framework.args.map(arg => arg.id)
  const rejected = computeRejected(framework, firstExtension)
  const undecided = allArgs.filter(arg => !firstExtension.includes(arg) && !rejected.includes(arg))

  const provenance = generateProvenance(framework, firstExtension, rejected, undecided, "stable")

  return {
    accepted: firstExtension,
    rejected,
    undecided,
    provenance,
    extensions,
  }
}

/**
 * Compute preferred semantics - returns stable and non-stable preferred extensions
 */
async function computePreferredSemantics(
  framework: ArgumentFramework,
  run: any,
): Promise<SemanticsResult> {
  console.log("Computing preferred semantics...")

  const { fromASP } = createIdMapping(framework)

  // First, get all stable extensions
  const stableFacts = frameworkToASP(framework, false)
  const stableProgram = stableFacts + "\n" + STABLE_ENCODING
  const stableResult = await run(stableProgram, 0)
  const stableExtensionSets = extractExtensions(stableResult, fromASP)
  
  // Then, get all preferred extensions
  const preferredFacts = frameworkToASP(framework, false)
  const preferredProgram = preferredFacts + "\n" + PREFERRED_ENCODING
  const preferredResult = await run(preferredProgram, 0)
  const preferredExtensionSets = extractExtensions(preferredResult, fromASP)

  console.log("Stable extensions:", stableExtensionSets.length)
  console.log("Preferred extensions:", preferredExtensionSets.length)

  // Categorize preferred extensions as stable or non-stable
  const stableExtensions: Extension[] = []
  const nonStableExtensions: Extension[] = []

  for (const prefExt of preferredExtensionSets) {
    const prefArray = Array.from(prefExt).sort()
    const isStable = stableExtensionSets.some(stableExt => {
      const stableArray = Array.from(stableExt).sort()
      return prefArray.length === stableArray.length && 
             prefArray.every((v, i) => v === stableArray[i])
    })

    if (isStable) {
      stableExtensions.push({ members: prefArray, isStable: true })
    } else {
      nonStableExtensions.push({ members: prefArray, isStable: false })
    }
  }

  // All extensions combined
  const allExtensions = [...stableExtensions, ...nonStableExtensions]

  if (allExtensions.length === 0) {
    return createEmptyResult(framework)
  }

  // Use first extension for default coloring
  const firstExtension = allExtensions[0].members
  const allArgs = framework.args.map(arg => arg.id)
  const rejected = computeRejected(framework, firstExtension)
  const undecided = allArgs.filter(arg => !firstExtension.includes(arg) && !rejected.includes(arg))

  const provenance = generateProvenance(framework, firstExtension, rejected, undecided, "preferred")

  return {
    accepted: firstExtension,
    rejected,
    undecided,
    provenance,
    extensions: allExtensions,
    stableExtensions,
    preferredNonStableExtensions: nonStableExtensions,
  }
}

/**
 * Compute complete semantics - returns grounded, stable, non-stable preferred, and other complete extensions
 */
async function computeCompleteSemantics(
  framework: ArgumentFramework,
  run: any,
): Promise<SemanticsResult> {
  console.log("Computing complete semantics...")

  const { fromASP } = createIdMapping(framework)

  // Get grounded extension using length_cal encoding
  const groundedResult = await computeGroundedWithLength(framework, run)
  const groundedExtension = groundedResult.accepted

  // Get all complete extensions
  const completeFacts = frameworkToASP(framework, false)
  const completeProgram = completeFacts + "\n" + COMPLETE_ENCODING
  const completeResult = await run(completeProgram, 0)
  const completeExtensionSets = extractExtensions(completeResult, fromASP)

  // Get stable extensions
  const stableFacts = frameworkToASP(framework, false)
  const stableProgram = stableFacts + "\n" + STABLE_ENCODING
  const stableResult = await run(stableProgram, 0)
  const stableExtensionSets = extractExtensions(stableResult, fromASP)

  // Get preferred extensions
  const preferredFacts = frameworkToASP(framework, false)
  const preferredProgram = preferredFacts + "\n" + PREFERRED_ENCODING
  const preferredResult = await run(preferredProgram, 0)
  const preferredExtensionSets = extractExtensions(preferredResult, fromASP)

  // Helper to check if two extensions are equal
  const extensionsEqual = (ext1: Set<string>, ext2: string[]): boolean => {
    const arr1 = Array.from(ext1).sort()
    return arr1.length === ext2.length && arr1.every((v, i) => v === ext2[i])
  }

  // Categorize extensions
  const stableExtensions: Extension[] = stableExtensionSets.map(ext => ({
    members: Array.from(ext).sort(),
    isStable: true
  }))

  const preferredNonStableExtensions: Extension[] = []
  for (const prefExt of preferredExtensionSets) {
    const prefArray = Array.from(prefExt).sort()
    const isStable = stableExtensionSets.some(stableExt => extensionsEqual(stableExt, prefArray))

    if (!isStable) {
      preferredNonStableExtensions.push({ members: prefArray, isStable: false })
    }
  }

  // Other complete extensions (not grounded, not stable, not preferred)
  const otherCompleteExtensions: Extension[] = []
  const groundedArray = groundedExtension.sort()
  
  for (const compExt of completeExtensionSets) {
    const compArray = Array.from(compExt).sort()
    
    // Check if it's the grounded extension
    const isGrounded = compArray.length === groundedArray.length && 
                       compArray.every((v, i) => v === groundedArray[i])
    if (isGrounded) continue

    // Check if it's a stable extension
    const isStable = stableExtensionSets.some(stableExt => extensionsEqual(stableExt, compArray))
    if (isStable) continue

    // Check if it's a preferred extension
    const isPreferred = preferredExtensionSets.some(prefExt => extensionsEqual(prefExt, compArray))
    if (isPreferred) continue

    // It's an "other" complete extension
    otherCompleteExtensions.push({ members: compArray, isStable: false })
  }

  // Use grounded extension for default coloring
  const rejected = groundedResult.rejected
  const undecided = groundedResult.undecided

  return {
    accepted: groundedExtension,
    rejected,
    undecided,
    provenance: groundedResult.provenance,
    groundedExtension,
    stableExtensions,
    preferredNonStableExtensions,
    otherCompleteExtensions,
  }
}

/**
 * Compute grounded semantics with length calculation
 */
async function computeGroundedWithLength(
  framework: ArgumentFramework,
  run: any,
): Promise<SemanticsResult> {
  console.log("Computing grounded semantics with length calculation...")

  const { fromASP } = createIdMapping(framework)

  // Convert framework to ASP facts using attack format
  const facts = frameworkToASP(framework, true)
  console.log("ASP Facts:", facts)

  // Combine facts and length_cal encoding
  const program = facts + "\n" + LENGTH_CAL_ENCODING

  // Run clingo with the program
  console.log("Running clingo...")
  let result: any
  try {
    result = await run(program, 0)
    console.log("Clingo result received")
  } catch (runError) {
    console.error("Error running clingo:", runError)
    throw runError
  }
  
  console.log("Clingo result:", result)
  console.log("Result type:", typeof result)
  console.log("Result keys:", result ? Object.keys(result) : "null")

  // Check for errors
  if ("Error" in result) {
    console.error("Clingo returned an error:", result.Error)
    throw new Error(`Clingo error: ${result.Error}`)
  }

  // Extract length-based results
  console.log("Extracting length results...")
  const { accepted: acceptedMap, defeated: defeatedMap, undefined: undefinedSet } = extractLengthResults(result, fromASP)
  console.log("Extracted results:", { accepted: acceptedMap, defeated: defeatedMap, undefined: undefinedSet })

  // Convert to arrays
  const accepted = Array.from(acceptedMap.keys())
  const rejected = Array.from(defeatedMap.keys())
  const undecided = Array.from(undefinedSet)

  console.log("Converted to arrays:", { accepted, rejected, undecided })

  // Generate provenance information with length data
  console.log("Generating provenance...")
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)
  const provenance: Record<string, ProvenanceInfo> = {}

  // For accepted arguments
  accepted.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []
    const length = acceptedMap.get(arg) || 0

    provenance[arg] = {
      status: "accepted",
      reason:
        length === 0
          ? "This argument is not attacked by any other argument"
          : `This argument is accepted at length ${length} (all attackers are defeated)`,
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: [],
      primaryProvenance: argDefenders,
      actualProvenance: [...argAttackers, ...argDefenders],
      length,
    }
  })

  // For rejected (defeated) arguments
  rejected.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []
    const length = defeatedMap.get(arg) || 1
    const attackingAccepted = accepted.filter((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    provenance[arg] = {
      status: "rejected",
      reason: `This argument is defeated at length ${length} by accepted argument(s): ${attackingAccepted.join(", ")}`,
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: argAttackers,
      primaryProvenance: [],
      actualProvenance: [...argAttackers, ...argDefenders],
      length,
    }
  })

  // For undecided arguments
  undecided.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []

    provenance[arg] = {
      status: "undecided",
      reason: "This argument is in a cycle (undefined/infinity length)",
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: argAttackers,
      primaryProvenance: argDefenders,
      actualProvenance: [...argAttackers, ...argDefenders],
      length: Infinity,
    }
  })

  const finalResult = {
    accepted,
    rejected,
    undecided,
    provenance,
  }

  console.log("Grounded semantics computation complete:", finalResult)
  console.log("[computeGroundedWithLength] Returning finalResult NOW")
  return finalResult
}

/**
 * Compute rejected arguments based on accepted arguments
 */
function computeRejected(framework: ArgumentFramework, accepted: string[]): string[] {
  const rejected: string[] = []
  const allArgs = framework.args.map((arg) => arg.id)

  for (const arg of allArgs) {
    if (accepted.includes(arg)) continue

    // An argument is rejected if it's attacked by an accepted argument
    const isAttackedByAccepted = framework.attacks.some(
      (att) => att.to === arg && accepted.includes(att.from),
    )

    if (isAttackedByAccepted) {
      rejected.push(arg)
    }
  }

  return rejected
}

/**
 * Generate provenance information for each argument
 */
function generateProvenance(
  framework: ArgumentFramework,
  accepted: string[],
  rejected: string[],
  undecided: string[],
  semantics: Semantics,
): Record<string, ProvenanceInfo> {
  const provenance: Record<string, ProvenanceInfo> = {}
  const attackers = getAttackers(framework)
  const defenders = getDefenders(framework, attackers)

  // For accepted arguments
  accepted.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []

    provenance[arg] = {
      status: "accepted",
      reason:
        argAttackers.length === 0
          ? "This argument is not attacked by any other argument"
          : "All attackers of this argument are defeated",
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: [],
      primaryProvenance: argDefenders,
      actualProvenance: [...argAttackers, ...argDefenders],
    }
  })

  // For rejected arguments
  rejected.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []
    const attackingAccepted = accepted.filter((acc) =>
      framework.attacks.some((att) => att.from === acc && att.to === arg),
    )

    provenance[arg] = {
      status: "rejected",
      reason: `This argument is attacked by accepted argument(s): ${attackingAccepted.join(", ")}`,
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: argAttackers,
      primaryProvenance: [],
      actualProvenance: [...argAttackers, ...argDefenders],
    }
  })

  // For undecided arguments
  undecided.forEach((arg) => {
    const argAttackers = attackers[arg] || []
    const argDefenders = defenders[arg] || []

    provenance[arg] = {
      status: "undecided",
      reason:
        semantics === "stable"
          ? "No stable extension exists for this framework"
          : "This argument is involved in a cycle or attacked by undecided arguments",
      attackers: argAttackers,
      defenders: argDefenders,
      potentialProvenance: argAttackers,
      primaryProvenance: argDefenders,
      actualProvenance: [...argAttackers, ...argDefenders],
    }
  })

  return provenance
}

/**
 * Helper function to get all attackers for each argument
 */
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

/**
 * Helper function to get all defenders for each argument
 */
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

/**
 * Create an empty result when no extensions are found
 */
function createEmptyResult(framework: ArgumentFramework): SemanticsResult {
  const argIds = framework.args.map((arg) => arg.id)
  const provenance: Record<string, ProvenanceInfo> = {}

  argIds.forEach((id) => {
    provenance[id] = {
      status: "undecided",
      reason: "No extension found for this framework",
      attackers: [],
      defenders: [],
      potentialProvenance: [],
      primaryProvenance: [],
      actualProvenance: [],
    }
  })

  return {
    accepted: [],
    rejected: [],
    undecided: argIds,
    provenance,
  }
}
