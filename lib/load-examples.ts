import type { ArgumentFramework, ExampleFramework } from "./types"

// Function to load example frameworks from JSON files
export async function loadExampleFrameworks(): Promise<ExampleFramework[]> {
    try {
        // First, try to get a list of available example files
        // Since we can't easily list files in the browser, we'll try to load known examples
        // and gracefully handle failures
        const examples: ExampleFramework[] = []

        // Try to load all the JSON files that exist in the examples folder
        const possibleFiles = [
            'simple',
            'simple_game',
            'double_loop',
            'dix',
            'meal_wine',
            'min_uniq_stb',
            'unique-stb',
            'tapp24',
            'tapp25',
            'safa24',
            'matti_lpnmr_2024',
            'martin_str',
            'pierson_post',
            'wild-animals'
        ]

        for (const fileName of possibleFiles) {
            try {
                const response = await fetch(`/examples/${fileName}.json`)
                if (response.ok) {
                    const jsonData = await response.json()

                    // Convert from JSON format to internal format
                    const framework: ArgumentFramework = {
                        name: jsonData.name,
                        args: jsonData.arguments,
                        attacks: jsonData.defeats
                    }

                    examples.push({
                        id: fileName,
                        name: jsonData.name,
                        framework
                    })
                }
            } catch (error) {
                // Silently skip files that don't exist or can't be loaded
                console.debug(`Skipping example ${fileName}: not found or invalid`)
            }
        }

        return examples
    } catch (error) {
        console.error('Error loading example frameworks:', error)
        return []
    }
} 