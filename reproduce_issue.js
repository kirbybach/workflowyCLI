function getSuggestions(line) {
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] || "";
    console.log(`Debug - Line: '${line}'`);
    console.log(`Debug - Parts: ${JSON.stringify(parts)}`);
    console.log(`Debug - Last: '${last}'`);
    // Check if we are completing a command (first word)
    if (parts.length === 1 && !line.includes(' ')) {
        const cmds = ['ls', 'cd', 'add', 'rm', 'mv', 'edit', 'complete', 'refresh', 'clear', 'help', 'tree', 'exit'];
        const matches = cmds.filter(c => c.startsWith(last));
        return [matches, last];
    }
    // Mock children for testing
    const children = [
        { name: 'Documents' },
        { name: 'My Folder' },
        { name: 'Notes' }
    ];
    const names = children.map((c) => c.name);
    const matches = names.filter((n) => n.startsWith(last));
    return [matches, last];
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
export {};
//# sourceMappingURL=reproduce_issue.js.map