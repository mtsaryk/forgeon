## Overview

`files-s3` is the S3-compatible provider for the `files-storage-adapter` capability.

It is intended for:
- AWS S3
- Cloudflare R2
- MinIO
- other S3-compatible endpoints

This module provides runtime S3 storage integration used by `files` when `FILES_STORAGE_DRIVER=s3`.
