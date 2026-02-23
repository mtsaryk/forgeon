# create-forgeon

CLI package for generating Forgeon fullstack monorepo projects.

## Usage

```bash
npx create-forgeon@latest my-app --frontend react --db prisma --i18n true --docker true --proxy nginx
```

If flags are omitted, the CLI asks interactive questions.

## Notes

- Implemented presets right now:
  - `--frontend react`
  - `--db prisma`
- `--proxy` works only when `--docker true`
