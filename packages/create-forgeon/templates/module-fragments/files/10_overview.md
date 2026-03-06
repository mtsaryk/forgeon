## Overview

`files` is the base runtime for file metadata and storage-driver selection.

It currently adds:
- `@forgeon/files` package
- files env/config wiring in API runtime
- module-level base settings used by storage adapter providers

The module follows capability-first rules:
- requires `db-adapter`
- requires `files-storage-adapter`
