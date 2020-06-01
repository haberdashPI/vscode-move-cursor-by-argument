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
extension can currently fail if there are commas within a quoted expression, for
example. It will think the comma inside the quote delimits the next argument of
the surrounding function call falling outside the quotes. See
[#580](https://github.com/microsoft/vscode/issues/580) for more about this
limitation.
