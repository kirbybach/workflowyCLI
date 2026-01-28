# Workflowy CLI

A powerful command-line interface for Workflowy, allowing you to navigate and manipulate your Workflowy nodes directly from the terminal.


![wf2](https://github.com/user-attachments/assets/040b53a7-2fbc-4d7c-b7b7-af6487b96dad)


## Features

-   **Interactive REPL**: Navigate your Workflowy tree like a file system.
-   **Command History**: Remembers your command history between sessions.
-   **Bookmarks**: Quick shortcuts to jump between important topics or nodes.
-   **File System Semantics**: Use familiar commands like `ls`, `cd`, `mv`, `rm`, `cat`.
-   **JSON Output**: All commands support `--json` for scripting and automation.
-   **Rich Editing**: Edit notes using your preferred terminal editor ($EDITOR).
-   **Visual Tree**: View your nested lists with a tree visualization.
-   **Clipboard Support**: Copy nodes and their children to the clipboard.

## Installation

```bash
git clone https://github.com/kirbybach/workflowyCLI.git
cd workflowyCLI
npm install
npm run build
npm link
```

## Usage

### 1. Authentication

First, you need to log in with your Workflowy API key.

```bash
wf login <your-api-key>
```

### 2. Interactive Session

Start the interactive shell:

```bash
wf
```

The CLI starts at the root directory and restores your command history.

### 3. Bookmarks

Save shortcuts to deep folders you use often:

```bash
# Save current location as a bookmark
wf mark home

# Jump back to that location later
wf goto home
```

### 4. Mock Mode

Test without affecting your real Workflowy data:

```bash
wf --mock
```
> [!NOTE]
> Bookmarks are stored separately for Mock vs. Real modes to prevent state interference.

### 5. Non-Interactive Commands

Run commands directly without entering the REPL (great for scripting):

```bash
# List items
wf ls                    # List root
wf ls Projects           # List path
wf ls -a                 # Show completed items

# Tree view
wf tree                  # Show tree
wf tree Projects 3       # Show tree depth 3

# Management
wf add "New Task"        # Add to current path
wf add "Item" -p /Inbox  # Add to specific path
wf rm "Item" -f          # Delete item (requires -f)
wf complete "Item"       # Toggle completion
wf mv "Item" "Dest"      # Move item

# Search & content
wf find "query"          # Search in current directory (default)
wf find . "query"        # Explicitly search current directory
wf find /Inbox "query"   # Search only within /Inbox
wf find "^Pro.*" -r      # Search with Regex
wf cat "Item"            # View details
wf copy 1                # Copy item to clipboard

# Scripting & JSON
wf ls --json             # Get JSON output
wf find "q" --json       # Search results as JSON
```

## Commands

Once inside the REPL, you can use the following commands:

| Command | Description | Usage |
| :--- | :--- | :--- |
| `ls` | List children of the current node | `ls [-a] [--json]` |
| `cd` | Change current node context | `cd <path>` (supports `..`, `/`, `[index]`) |
| `tree` | Show a visual tree of children | `tree [depth] [-a] [--json]` |
| `add` | Create a new node | `add <text> [note] [--json]` |
| `edit` | Edit a node's note in $EDITOR | `edit <target> [new_text] [--json]` |
| `cat` | Display node details (name and note) | `cat <target> [--json]` |
| `mark` | Bookmark current location | `mark <name> [--json]` |
| `goto` | Jump to a bookmarked location | `goto <name> [--json]` |
| `mv` | Move a node | `mv <source> <dest> [--json]` |
| `rm` | Delete a node (requires -f) | `rm -f <target> [--json]` |
| `complete` | Toggle completion status | `complete <target> [--json]` |
| `copy` | Copy node content to clipboard | `copy [index] [--json]` |
| `find` | Search for nodes (local cache) | `find [path] <query> [--notes] [--regex] [--json]` |
| `sync` | Force full tree sync | `sync [--json]` |
| `refresh` | Refresh the current view | `refresh [--json]` |
| `clear` | Clear the screen | `clear` |
| `help` | Show available commands | `help [command]` |
| `exit` | Exit the REPL | `exit` or `Ctrl+C` |

### Global Flags

| Flag | Description |
| :--- | :--- |
| `--json` | Output as JSON (for scripting) |
| `-f`, `--force` | Confirm deletion (required for `rm`) |
| `-a`, `--all` | Include completed items |

### Examples

**Navigate and List:**
```bash
> ls
[1] Projects
[2] Personal

> cd Projects
> ls
[1] WorkflowyCLI
[2] Blog
```

**Bookmarks & Jumping:**
```bash
> mark dev  # Saved current location as 'dev'
> cd /
> goto dev  # Instantly back to /Projects/WorkflowyCLI
```

**Viewing & Editing:**
```bash
> cat 1
WorkflowyCLI
This node contains the CLI development tasks.

> add "Task" "Need to fix bug"
> edit 1 "Updated Task Name"  # Quick rename
> edit 1                      # Opens $EDITOR for full content
```

**Move Items:**
```bash
> mv 2 ..  # Moves item 2 to the parent directory
> mv 1 2   # Moves item 1 into item 2 (as child)
```

**Complete Items:**
```bash
> complete 1  # Mark as complete
> ls -a       # Show all items including completed
```

**Instant Search:**
```bash
> sync  # Force initial full sync
> cd Projects
> find "idea"         # Searches only in /Projects
[1] /Projects/New Idea
    New Idea

> find / "idea"       # Searches everywhere
[1] /Projects/New Idea
[2] /Personal/Gift Idea
```

## JSON Output for Scripting

All core commands support `--json` output for easy scripting and automation:

```bash
> ls --json
{
  "path": "/Projects",
  "count": 3,
  "children": [
    { "index": 1, "id": "abc123", "name": "Task 1", "completed": false },
    { "index": 2, "id": "def456", "name": "Task 2", "completed": true }
  ]
}

> add "New Task" --json
{
  "success": true,
  "node": { "id": "xyz789", "name": "New Task" }
}

> tree --json
{
  "path": "/",
  "tree": [
    { "name": "Projects", "children": [...] }
  ]
}
```

## Export & Import

Export your Workflowy data in multiple formats:

```bash
# Export as markdown
wf export /Projects --format=markdown > backup.md

# Export as JSON
wf export --format=json > backup.json

# Export as OPML (for interoperability)
wf export --format=opml > backup.opml

# Import from stdin
cat tasks.json | wf import --format=json
echo "- Task 1\n  - Subtask" | wf import --format=markdown
```

## MCP Server (AI Agent Integration)

WorkflowyCLI includes an MCP (Model Context Protocol) server, allowing AI agents like Claude to use your Workflowy as a tool.

### Setup

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "workflowy": {
      "command": "wf",
      "args": ["mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
| :--- | :--- |
| `wf_ls` | List children at a path |
| `wf_tree` | Get tree structure with depth |
| `wf_add` | Create a new node |
| `wf_rm` | Delete a node |
| `wf_complete` | Toggle completion status |
| `wf_find` | Search for nodes |
| `wf_export` | Export subtree to JSON/markdown |

### Command Help

Get detailed help for any command:

```bash
> help ls
ls - List children of current node

Usage: ls [-a] [--json]

Flags:
      --json         Output as JSON
  -f, --force        Confirm deletion (required)
  -a, --all          Show completed items
```

## Development

To run the project in development mode:

```bash
npm run dev
```

### Mock Mode

For testing without hitting the real Workflowy API:

```bash
# Using the --mock flag
wf --mock

# Or using npm scripts
npm run dev:mock

# Run integration tests
npm test
```

Mock mode uses a fake in-memory tree, perfect for development and testing.

## License

MIT


