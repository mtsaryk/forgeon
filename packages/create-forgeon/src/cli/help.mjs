export function printHelp() {
  console.log(`create-forgeon

Usage:
  npx create-forgeon@latest <project-name> [options]
  npx create-forgeon@latest add <module-id> [options]
  npx create-forgeon@latest add --list

Create options:
  --db-prisma <true|false>     Enable db-prisma module (default: true)
  --i18n <true|false>          Enable i18n (default: true)
  --proxy <caddy|nginx|none>   Reverse proxy preset (default: caddy)
  --install                    Run pnpm install after generation
  -y, --yes                    Skip prompts and use defaults
  -h, --help                   Show this help

Add options:
  --project <path>             Target project path (default: current directory)
  --list                       List available modules
`);
}
