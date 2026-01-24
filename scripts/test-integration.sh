#!/bin/bash
#
# Integration test script for workflowyCLI
# 
# Runs in mock mode to test CLI commands without hitting real Workflowy API.
#
# Usage:
#   npm run build && ./scripts/test-integration.sh
#

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Enable mock mode
export WF_MOCK=1
export WF_RESET=1

# Count tests
PASSED=0
FAILED=0

# Helper function to run a test
run_test() {
    local name="$1"
    local cmd="$2"
    local expected="$3"
    
    printf "Testing: %s... " "$name"
    
    # Run command and capture output
    if output=$(eval "$cmd" 2>&1); then
        if [ -n "$expected" ]; then
            if echo "$output" | grep -q "$expected"; then
                echo -e "${GREEN}PASSED${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${RED}FAILED${NC}"
                echo "  Expected: $expected"
                echo "  Got: $output"
                FAILED=$((FAILED + 1))
            fi
        else
            echo -e "${GREEN}PASSED${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Command failed: $cmd"
        echo "  Output: $output"
        FAILED=$((FAILED + 1))
    fi
}

# Header
echo ""
echo "╭────────────────────────────────────────╮"
echo "│   WorkflowyCLI Integration Tests       │"
echo "│   Running in MOCK MODE                 │"
echo "╰────────────────────────────────────────╯"
echo ""

# --- Basic Commands ---
echo -e "${YELLOW}=== Basic Commands ===${NC}"

run_test "wf --help" \
    "node dist/index.js --help" \
    "CLI for Workflowy"

run_test "wf --version" \
    "node dist/index.js --version" \
    "1.0.0"

# --- REPL Commands (via echo piping) ---
echo -e "\n${YELLOW}=== Session Start ===${NC}"

# Test that mock mode shows proper message
run_test "Mock mode indicator" \
    "echo 'exit' | node dist/index.js" \
    "Mock mode active"

# Test ls command in mock mode
run_test "ls shows mock data" \
    "echo 'ls' | node dist/index.js" \
    "Projects"

# Test that cd command is recognized (look for cd + the input echoed)
run_test "cd command executes" \
    "printf 'cd 1\nexit\n' | node dist/index.js" \
    "cd 1"

# Test tree command
run_test "tree shows hierarchy" \
    "echo 'tree 1' | node dist/index.js" \
    "Projects"

# Test add command
run_test "add command works" \
    "echo 'add \"Test Item\"' | node dist/index.js" \
    "Created: Test Item"

# Test complete command  
run_test "complete command works" \
    "echo 'complete 1' | node dist/index.js" \
    "Completed"

# Test rm with force flag
run_test "rm with force works" \
    "echo 'rm -f 1' | node dist/index.js" \
    "Deleted"

# Test help command
run_test "help command works" \
    "echo 'help' | node dist/index.js" \
    "Available commands"

# --- JSON Output Tests ---
echo -e "\n${YELLOW}=== JSON Output ===${NC}"

run_test "ls --json outputs valid JSON" \
    "echo 'ls --json' | node dist/index.js" \
    '"children"'

run_test "tree --json outputs nested data" \
    "echo 'tree --json' | node dist/index.js" \
    '"tree"'

run_test "add --json returns node info" \
    "echo 'add \"JSON Test\" --json' | node dist/index.js" \
    '"success": true'

run_test "help ls shows command help" \
    "echo 'help ls' | node dist/index.js" \
    "Usage: ls"

# --- Non-Interactive Commands ---
echo -e "\n${YELLOW}=== Non-Interactive Commands ===${NC}"

run_test "wf ls (non-interactive)" \
    "node dist/index.js ls" \
    "Projects"

run_test "wf ls --json (non-interactive)" \
    "node dist/index.js ls --json" \
    '"children"'

run_test "wf ls <path> navigates" \
    "node dist/index.js ls Projects" \
    "WorkflowyCLI"

run_test "wf add creates node" \
    "node dist/index.js add 'CLI Test' --json" \
    '"success": true'

run_test "wf tree shows hierarchy" \
    "node dist/index.js tree 1" \
    "Projects"

run_test "wf add accepts piped input" \
    "echo 'Piped Node' | node dist/index.js add - --json" \
    '"name": "Piped Node"'

# --- Path Resolution Tests ---
echo -e "\n${YELLOW}=== Path Resolution ===${NC}"

run_test "wf ls /Projects works (absolute)" \
    "node dist/index.js ls /Projects" \
    "WorkflowyCLI"

run_test "wf add to relative path" \
    "node dist/index.js add 'Nested Item' -p Projects --json" \
    '"success": true'

run_test "wf ls nested path /Projects/WorkflowyCLI" \
    "node dist/index.js ls /Projects/WorkflowyCLI" \
    "Add search feature"

# --- Search & Sync Tests ---
echo -e "\n${YELLOW}=== Search & Sync ===${NC}"

run_test "wf sync runs" \
    "node dist/index.js sync --json" \
    '"success": true'

run_test "wf find works (cached)" \
    "node dist/index.js find 'Projects' --json" \
    '"name": "Projects"'

run_test "wf find with limit" \
    "node dist/index.js find 'bug' --limit 1 --json" \
    '"count": 1'

# --- Refactored Commands Tests ---
echo -e "\n${YELLOW}=== Refactored Commands ===${NC}"

run_test "wf copy output (stub)" \
    "node dist/index.js copy 1 --json" \
    '"success": true'

run_test "wf mv moves node" \
    "node dist/index.js mv '/Projects/WorkflowyCLI/Add search feature' '/Projects/WorkflowyCLI/Fix bugs' --json" \
    '"success": true'

# --- Sprint 4 Tests (Polish) ---
echo -e "\n${YELLOW}=== Sprint 4 (Polish) ===${NC}"

run_test "wf cat node" \
    "node dist/index.js cat 1 --json" \
    '"name":'

run_test "wf mark creates bookmark" \
    "node dist/index.js mark test_bm --json" \
    '"success": true'

run_test "wf goto uses bookmark" \
    "node dist/index.js goto test_bm --json" \
    '"success": true'

run_test "wf goto uses bookmark" \
    "node dist/index.js goto test_bm --json" \
    '"success": true'

# --- Persistence Tests ---
echo -e "\n${YELLOW}=== Persistence Tests ===${NC}"

# 1. Set state (with reset to ensure clean start)
WF_RESET=1 node dist/index.js cd Projects

# 2. Verify state persists (unset RESET)
unset WF_RESET
run_test "wf persists session (cwd)" \
    "node dist/index.js ls" \
    "WorkflowyCLI"

# 3. Restore safety
export WF_RESET=1

# --- Summary ---
echo ""
echo "────────────────────────────────────────"
TOTAL=$((PASSED + FAILED))
echo -e "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC} (of ${TOTAL})"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
