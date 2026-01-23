# Workflowy CLI

A powerful command-line interface for Workflowy, allowing you to navigate and manipulate your Workflowy nodes directly from the terminal.

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
workflowy login <your-api-key>
```

### 2. Interactive Session

Start the interactive shell:

```bash
workflowy
```

or explicitly:

```bash
workflowy repl
```

## Commands

Once inside the REPL, you can use the following commands:

| Command | Description | Usage |
| :--- | :--- | :--- |
| `ls` | List children of the current node | `ls` |
| `cd` | Change current node context | `cd <node_name_or_index>` (supports `..`) |
| `tree` | Show a visual tree of children | `tree` or `tree <depth>` |
| `add` | Create a new node | `add <text>` |
| `edit` | Edit a node's note in $EDITOR | `edit <index>` |
| `mv` | Move a node | `mv <source_index> <dest_index>` |
| `rm` | Delete a node | `rm <index>` |
| `copy` | Copy node content to clipboard | `copy <index>` |
| `refresh` | Refresh the current view | `refresh` |
| `exit` | Exit the REPL | `exit` or `Ctrl+C` |

### Examples

**Navigate and List:**
```bash
> ls
0. Projects
1. Personal
2. Archive

> cd Projects
> ls
0. WorkflowyCLI
1. Website
```

**Create and Edit:**
```bash
> add "New Idea"
> edit 2  # Opens default editor for "New Idea"
```

**Move Items:**
```bash
> mv 2 0  # Moves item at index 2 to index 0
```

## Development

To run the project in development mode:

```bash
npm run dev
```

## License

MIT
