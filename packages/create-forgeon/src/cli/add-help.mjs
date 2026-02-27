export function printAddHelp() {
  console.log(`create-forgeon add

Usage:
  npx create-forgeon@latest add <module-id> [options]

Options:
  --project <path>   Target project path (default: current directory)
  --list             List available modules
  -h, --help         Show this help

Note:
  Pair integrations are explicit.
  Run "pnpm forgeon:sync-integrations" in the target project after add-module steps.
`);
}
