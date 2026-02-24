# Board Create: lists & labels fix

**Date:** 2026-02-24
**Status:** Approved

## Problem

The Kan API requires `lists` and `labels` arrays when creating a board. The current
`boardsHandler` only sends `{ name }`, causing a 400 validation error.

## Changes

### `src/tools/boards.ts`

- Add `lists?: string[]` to `BoardsParams`
- In the `create` case: default `lists` to `["do", "doing", "done"]`, map to
  `[{ name }]` objects, and always include `labels: []`
- Add `lists` to the Zod schema with a description noting the default

### `src/tools/boards.test.ts`

- Update existing create test to assert `lists` and `labels` are in the POST body
- Add test: custom list names are forwarded correctly
- Add test: default lists are used when `lists` is omitted
