# Workflowy CLI

A powerful command-line interface for Workflowy, allowing you to navigate and manipulate your Workflowy nodes directly from the terminal.


https://github.com/user-attachments/assets/eb7580ca-5296-4322-a5e4-5c9cb824a913


## Features

-   **Interactive REPL**: Navigate your Workflowy tree like a file system.
-   **File System Semantics**: Use familiar commands like `ls`, `cd`, `mv`, `rm`.
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

or explicitly:

```bash
wf repl
```

### 3. Mock Mode

Test without affecting your real Workflowy data:

```bash
wf --mock
```

### 4. Non-Interactive Commands

Run commands directly without entering the REPL (great for scripting):

```bash
# List items at root
wf ls

# List items at a path
wf ls Projects

# Add a new item
wf add "New Task"

# Add to a specific path
wf add "Sub Task" -p Projects/WorkflowyCLI

# Get JSON output for scripting
wf ls --json
wf tree --json
wf add "Task" --json
```

## Commands

Once inside the REPL, you can use the following commands:

| Command | Description | Usage |
| :--- | :--- | :--- |
| `ls` | List children of the current node | `ls [-a] [--json]` |
| `cd` | Change current node context | `cd <name_or_index>` (supports `..`, `/`, `~`) |
| `tree` | Show a visual tree of children | `tree [depth] [-a] [--json]` |
| `add` | Create a new node | `add <text> [note] [--json]` |
| `edit` | Edit a node's note in $EDITOR | `edit <index> [new_text]` |
| `mv` | Move a node | `mv <source> <dest>` (dest can be `..`) |
| `rm` | Delete a node | `rm [-f] <index> [--json]` |
| `complete` | Toggle completion status | `complete <index> [--json]` |
| `copy` | Copy node content to clipboard | `copy [index]` |
| `refresh` | Refresh the current view | `refresh` |
| `clear` | Clear the screen | `clear` |
| `help` | Show available commands | `help [command]` |
| `exit` | Exit the REPL | `exit` or `Ctrl+C` |

### Global Flags

| Flag | Description |
| :--- | :--- |
| `--json` | Output as JSON (for scripting) |
| `-f`, `--force` | Skip confirmation prompts |
| `-a`, `--all` | Include completed items |

### Examples

**Navigate and List:**
```bash
> ls
[1] Projects
[2] Personal
[3] Archive

> cd Projects
> ls
[1] WorkflowyCLI
[2] Website
```

**Create and Edit:**
```bash
> add "New Idea"
> add "Task" "This is a note for the task"
> edit 1  # Opens default editor for the first item
```

**Move Items:**
```bash
> mv 2 ..  # Moves item 2 to the parent directory
> mv 1 3   # Moves item 1 into item 3 (as child)
```

**Complete Items:**
```bash
> complete 1  # Mark as complete
> complete 1  # Toggle back to incomplete
> ls -a       # Show all items including completed
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

### Command Help

Get detailed help for any command:

```bash
> help ls
ls - List children of current node

Usage: ls [-a] [--json]

Flags:
      --json         Output as JSON
  -f, --force        Skip confirmations
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


