// Simple test script for clingo-wasm integration
import { computeSemanticsWithClingo } from "./lib/clingo-semantics.ts"

// Test framework: A -> B, B -> A (simple cycle)
const testFramework = {
  args: [
    { id: "a", annotation: "Argument A" },
    { id: "b", annotation: "Argument B" },
  ],
  attacks: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
}

console.log("Testing clingo-wasm integration...")
console.log("Test framework:", JSON.stringify(testFramework, null, 2))

// Test all semantics
const semanticsToTest = ["grounded", "stable", "preferred", "complete"]

for (const semantics of semanticsToTest) {
  console.log(`\n--- Testing ${semantics} semantics ---`)
  try {
    const result = await computeSemanticsWithClingo(testFramework, semantics)
    console.log("Accepted:", result.accepted)
    console.log("Rejected:", result.rejected)
    console.log("Undecided:", result.undecided)
  } catch (error) {
    console.error(`Error testing ${semantics}:`, error.message)
  }
}

console.log("\n✅ All tests completed!")
