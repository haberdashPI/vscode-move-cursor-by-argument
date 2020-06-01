# Move by Arguments

This small VSCode extension leverages a syntactic structure common to many
languages---arguments---and lets you move and select text in terms of this
structure.

Here, a set of arguments is defined as all text within a pair of brackets: `[]`,
`()` or `{}`, where each argument is separated by `,` or `;`.

Using this extension, you can move the cursor by arguments or select arguments.
You can also select the entire set of arguments plus the preceding identifier: a
very common form for a function call.

## Limitations

To keep things simple, this leverages only the built-in APIs for interacting
with brackets and syntax. These are unfortunately quite limited, so this
extension has some unfortunate drawbacks:

- motion is a little slow and cursor will flash around a bunch: sending commands
  to move around brackets must move the cursor, you can't manipulate programmatic
  positions around brackets, so the user "sees" the computations this extension
  performs (albeit very rapidly)

- motions will stop at commas inside quotes: there is no API to determine
  whether the current characters fall inside a quote. Making this determinition
  would require redundant parsing of the source file.

See [#580](https://github.com/microsoft/vscode/issues/580) for more about why
these limitations exist.