# Move by Arguments

This small VSCode extension leverages a syntactic structure common to many
languages---arguments---and lets you move and select text in terms of this
structure.

Here, a set of arguments is defined as all text within a pair of brackets: `[]`,
`()` or `{}`, where each argument is separated by `,` or `;`.

Using this extension, you can move the cursor by arguments or select arguments.

## Command

There is a single command `move-cursor-by-argument.move-by-argument` which takes several arguments.

```typescript
{
    value?: number, // the number of arguments to move by to the left (negative) or right (positive).
    select?: boolean // whether to select or just move the cusor
    boundary?: string, // whether to include the boundary char (, or ;)
    selectWhole?: boolean, // whether to move both start and end selections to surround the current argument (rather than just extending one end of the selection)
}
```

To make use of the extension, you should ddefine a keybinding for this command in your keybindings.json file.

## Limitations

While this extension is quite usable, to keep things simple it leverages only
the built-in APIs for interacting with brackets and syntax. This leads to some
unfortunate drawbacks:

- motion can be slow and cursor can flash around: sending commands to move
  around brackets must move the cursor; you can't manipulate programmatic
  positions around brackets, so the user will sometimes "see" the computations
  this extension performs (albeit very rapidly)

- motions will stop at commas inside quotes: there is no built-in API to
  determine whether the current character falls inside a quote.

Ideally there would be a way to leverage the parsing VSCode already performs
for syntax highlighting using a bulit-in API. However, this is not possible (see
[#580](https://github.com/microsoft/vscode/issues/580)). The alternative, which
would be to parse the entire source file redundantly within each extension, is
not a sustainable approach for multiple, small extensions to take.
