import type { ExampleFramework } from "./types"

// Example frameworks for demonstration
export const exampleFrameworks: ExampleFramework[] = [
  {
    id: "simple",
    name: "Simple Framework",
    framework: {
      args: [
        { id: "a", annotation: "It will rain tomorrow", url: "https://example.com/argument/a" },
        {
          id: "b",
          annotation: "The forecast says it will be sunny",
          url: "https://example.com/argument/b",
        },
        { id: "c", annotation: "The forecast is often wrong", url: "https://example.com/argument/c" },
      ],
      attacks: [
        { from: "b", to: "a" },
        { from: "c", to: "b" },
      ],
    },
  },
  {
    id: "cycle",
    name: "Cycle Example",
    framework: {
      args: [
        { id: "a", annotation: "We should go to the beach", url: "https://example.com/argument/a" },
        { id: "b", annotation: "We should go to the mountains", url: "https://example.com/argument/b" },
        { id: "c", annotation: "We should stay home", url: "https://example.com/argument/c" },
      ],
      attacks: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    },
  },
  {
    id: "complex",
    name: "Complex Framework",
    framework: {
      args: [
        {
          id: "a",
          annotation: "The product should be released now",
          url: "https://example.com/argument/a",
        },
        { id: "b", annotation: "There are still bugs to fix", url: "https://example.com/argument/b" },
        { id: "c", annotation: "The bugs are minor", url: "https://example.com/argument/c" },
        {
          id: "d",
          annotation: "The competition is releasing similar features",
          url: "https://example.com/argument/d",
        },
        {
          id: "e",
          annotation: "Our product has unique advantages",
          url: "https://example.com/argument/e",
        },
      ],
      attacks: [
        { from: "b", to: "a" },
        { from: "c", to: "b" },
        { from: "d", to: "a" },
        { from: "e", to: "d" },
      ],
    },
  },
]
