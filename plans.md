Use this code to inspect the brackets we need to search for:
https://github.com/CoenraadS/Bracket-Pair-Colorizer-2/blob/develop/src/textMateLoader.ts#L136-L159

use built-in commands to move by and select brackets to find ranges

for argument motion:

- search for the commas and semi-colons within the range
- search for starting brackets within ranges
- move to the first comma or bracket, if it's a bracket move to ending bracket and
  then contiuing moving, stop when we hit a comma

for identifier + bracket motion:
- move by word, then move by next brackets (I think I can already do this
- move by word, move to brackets, select brackets, go back and add first
  identifier before the brackets
