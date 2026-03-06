export function printAddHelp() {
  console.log(`create-forgeon add

Usage:
  npx create-forgeon@latest add <module-id> [options]

Options:
  --project <path>   Target project path (default: current directory)
  --with-required    Allow recursive installation of hard prerequisites
  --with-recommended Auto-install recommended companion modules (non-TTY friendly)
  --provider <capability>=<module>
                     Explicit provider mapping for non-interactive dependency resolution
  --list             List available modules
  -h, --help         Show this help

Note:
  Hard prerequisites are resolved explicitly.
  Pair integrations remain explicit follow-up actions.
  Run "pnpm forgeon:sync-integrations" in the target project after add-module steps.
`);
}
