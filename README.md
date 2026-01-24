# Workflowy CLI

A powerful command-line interface for Workflowy, allowing you to navigate and manipulate your Workflowy nodes directly from the terminal.


https://github.com/user-attachments/assets/eb7580ca-5296-4322-a5e4-5c9cb824a913


## Features

-   **Interactive REPL**: Navigate your Workflowy tree like a file system.
-   **File System Semantics**: Use familiar commands like `ls`, `cd`, `mv`, `rm`.
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

## Commands

Once inside the REPL, you can use the following commands:

| Command | Description | Usage |
| :--- | :--- | :--- |
| `ls` | List children of the current node | `ls` or `ls -a` (show completed) |
| `cd` | Change current node context | `cd <name_or_index>` (supports `..`, `/`, `~`) |
| `tree` | Show a visual tree of children | `tree` or `tree <depth>` |
| `add` | Create a new node | `add <text>` or `add <text> <note>` |
| `edit` | Edit a node's note in $EDITOR | `edit <index>` or `edit <index> <new_text>` |
| `mv` | Move a node | `mv <source> <dest>` (dest can be `..`) |
| `rm` | Delete a node | `rm <index>` or `rm -f <index>` (force) |
| `complete` | Toggle completion status | `complete <index>` |
| `copy` | Copy node content to clipboard | `copy <index>` or `copy` (all) |
| `refresh` | Refresh the current view | `refresh` |
| `clear` | Clear the screen | `clear` |
| `help` | Show available commands | `help` |
| `exit` | Exit the REPL | `exit` or `Ctrl+C` |

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

## Development

To run the project in development mode:

```bash
npm run dev
```

### Mock Mode

For testing without hitting the real Workflowy API, use mock mode:

```bash
# Interactive mock mode
npm run dev:mock

# Run integration tests
npm test
```

Mock mode uses a fake in-memory tree, perfect for development and testing.

## License

MIT

