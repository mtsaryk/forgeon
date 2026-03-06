## Overview

`files-image` adds an image sanitation pipeline on top of `files`.

It provides:
- magic-bytes detection for actual file type
- declared/detected MIME mismatch rejection
- decode -> sanitize -> re-encode flow via `sharp`
- default metadata stripping before storage
- optional `preview` variant generation for files runtime
