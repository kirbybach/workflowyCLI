function getSuggestions(line) {
    // 1. Parse line to find the current argument being typed
    let inQuote = false;
    let currentArgStart = 0;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        }
        else if (char === ' ' && !inQuote) {
            currentArgStart = i + 1;
        }
    }
    const currentArg = line.slice(currentArgStart);
    console.log(`Debug - Line: '${line}'`);
    console.log(`Debug - Current Arg: '${currentArg}'`);
    // Check if we are completing a command (first word)
    const isCommand = currentArgStart === 0 && !line.includes(' ');
    // Note: line.includes(' ') check is insufficient if we have leading spaces, but basic logic:
    // If currentArgStart is 0, we are at the first word.
    if (isCommand) {
        const cmds = ['ls', 'cd', 'add', 'rm', 'mv', 'edit', 'complete', 'refresh', 'clear', 'help', 'tree', 'exit'];
        const matches = cmds.filter(c => c.startsWith(currentArg));
        return [matches, currentArg];
    }
    // Mock children for testing
    const children = [
        { name: 'Documents' },
        { name: 'My Folder' },
        { name: 'Notes' },
        { name: 'project "alpha"' }
    ];
    const names = children.map(c => c.name);
    let searchStr = currentArg;
    let isQuoted = false;
    if (currentArg.startsWith('"')) {
        isQuoted = true;
        searchStr = currentArg.slice(1);
    }
    // Filter matches
    const matches = names.filter(n => n.startsWith(searchStr));
    // Re-format matches for output
    // If the user started with a quote, we should return matches with that quote?
    // readline replaces 'currentArg' with the selection.
    // If currentArg is '"My Fo', and we return '"My Folder"', it works.
    const finalMatches = matches.map(n => {
        if (n.includes(' ') || isQuoted) {
            return `"${n}"`;
        }
        return n;
    });
    return [finalMatches, currentArg];
}
// Test cases
console.log('--- Test Case 1: Command completion ---');
console.log(getSuggestions('l'));
console.log('\n--- Test Case 2: Simple Argument completion ---');
console.log(getSuggestions('cd Doc'));
console.log('\n--- Test Case 3: Argument with space (quoted) - Partial ---');
console.log(getSuggestions('cd "My Fo'));
console.log('\n--- Test Case 4: Argument with space (quoted) - Start ---');
console.log(getSuggestions('cd "My'));
console.log('\n--- Test Case 5: Empty space after command ---');
console.log(getSuggestions('ls '));
console.log('\n--- Test Case 6: Multiple args, completing second ---');
console.log(getSuggestions('mv "My Folder" No'));
export {};
//# sourceMappingURL=solution_prototype.js.map