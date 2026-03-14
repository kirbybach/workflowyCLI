# Changelog

All notable changes to the WorkflowyCLI project will be documented in this file.

## [1.0.0] - 2026-03-13

### Core Capabilities
- **ID-Based Command Suite**:
    - `get <id>` — Fetch any node globally by UUID, bypassing `cd` state.
    - `update <id> --name="..." --note="..."` — Edit any node directly by UUID.
    - `insert <parentId> <name> [note]` — Create a child node under any parent by UUID.
    - Designed for LLM agents (like Batman/OpenClaw) to overcome stateful navigation challenges.
- **MCP Server Integration**: Supports the Model Context Protocol with tools for `ls`, `tree`, `add`, `rm`, `complete`, `find`, `export`, and the Batman suite (`get`, `update`, `insert`).
- **Import/Export Suite**: Supports Markdown, JSON, and OPML formats for both importing into and exporting from Workflowy.
- **Universal Scripting Support**:
    - Includes `--json` flag on all core commands for machine-readable output.
    - Non-interactive CLI support (e.g., `wf ls /Inbox`).
    - Absolute and relative path support.
    - Pipe support for the `add` command (e.g., `cat tasks.txt | wf add`).
- **Performance & Search**:
    - Implemented a full tree sync service with stale-while-revalidate caching.
    - Instant cached search via the `find` command.
- **UX Improvements**:
    - Bookmarks system (`mark` and `goto`) for quick navigation.
    - `cat` command for viewing node content and notes.
    - Persistent command history and session state.
    - Delete confirmation with TTY awareness and child count warning.
- **Developer Infrastructure**:
    - Command Registry for unified flag parsing and auto-generated help.
    - `MockWorkflowyClient` and integration testing suite.

### Fixed
- Note parameter support in the `add` command.
- `mv ..` logic for moving nodes to parent directories.
- API base URL updated to production.
- Toggling completion status now correctly supports uncompleting items.

---

## [Roadmap] - Upcoming Features

### AI & Scripting (Active Planning)
- **Core SDK Extraction**: Decoupling logic into `@workflowy/core` for programmatic usage.
- **`wf ai` Suite**: LLM-powered subcommands (`ask`, `summarize`, `subtasks`).
- **Shadow Git Backup**: One-way sync to a local Git repository for granular history.
- **Smart Templates**: Markdown templates with variable interpolation.
