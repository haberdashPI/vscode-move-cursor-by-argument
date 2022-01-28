/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/extension.ts":
/*!**************************!*\
  !*** ./src/extension.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(/*! vscode */ "vscode");
const vscode_1 = __webpack_require__(/*! vscode */ "vscode");
let languageBrackets = {};
function findBrackets() {
    // TODO: compute brackets based on the language configuration
    languageBrackets["default"] = { start: /(\(|\{|\[)/, stop: /(\]|\}|\))/ };
}
function bracketsFor(doc, dir) {
    if (dir === Direction.Forward) {
        return RegExp(languageBrackets["default"].start, "g");
    }
    else {
        return RegExp(languageBrackets["default"].stop, "g");
    }
}
var Direction;
(function (Direction) {
    Direction[Direction["Forward"] = 0] = "Forward";
    Direction[Direction["Backward"] = 1] = "Backward";
})(Direction || (Direction = {}));
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    findBrackets();
    vscode.workspace.onDidChangeConfiguration(findBrackets);
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "move-cursor-by-argument" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('move-cursor-by-argument.move-by-argument', (args) => {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            moveByArgument(editor, args);
            editor.revealRange(editor.selection);
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function findSurroundingBracketRange(editor, pos) {
    return __awaiter(this, void 0, void 0, function* () {
        // if we're right after a bracket, this will
        // select that inner range, rather than the outer range
        // we need to shift the cursor first, in this case,
        let endbracket = bracketsFor(editor.document, Direction.Backward);
        let charbefore = editor.document.getText(new vscode_1.Range(pos.translate(0, -1), pos));
        let range;
        if (endbracket.test(charbefore)) {
            let next = pos.translate(0, 1);
            editor.selection = new vscode.Selection(next, next);
            yield vscode.commands.executeCommand('editor.action.selectToBracket');
            range = new vscode.Range(editor.selection.start, editor.selection.end.translate(0, -1));
        }
        else {
            yield vscode.commands.executeCommand('editor.action.selectToBracket');
            range = new vscode.Range(editor.selection.start.translate(0, 1), editor.selection.end.translate(0, -1));
        }
        return range;
    });
}
function textLineFrom(editor, pos, range) {
    let end = editor.document.lineAt(pos).range.end;
    if (end.isAfter(range.end)) {
        end = range.end;
    }
    return editor.document.getText(new vscode_1.Range(pos, end));
}
function isBefore(a, b) {
    if (a === undefined) {
        return false;
    }
    else {
        return b === undefined || a < b;
    }
}
function nonZeroIndex(m) {
    return m !== null && m.index !== undefined && m.index > 0;
}
function clean(match) {
    if (match === null || match.index === undefined) {
        return undefined;
    }
    else {
        return match.index;
    }
}
var Token;
(function (Token) {
    Token[Token["Separator"] = 0] = "Separator";
    Token[Token["Bracket"] = 1] = "Bracket";
})(Token || (Token = {}));
function findMatchingBracket(editor, pos) {
    return __awaiter(this, void 0, void 0, function* () {
        editor.selection = new vscode.Selection(pos, pos);
        yield vscode.commands.executeCommand('editor.action.jumpToBracket');
        return editor.selection.active;
    });
}
function separatorsAndBrackets(document, range, dir) {
    let tokens = _separatorsAndBrackets(document, range, dir);
    if (dir === Direction.Forward) {
        return tokens;
    }
    else {
        return Array.from(tokens).reverse();
    }
}
function* _separatorsAndBrackets(document, range, dir) {
    let brackets = bracketsFor(document, dir);
    let separator = /(,|;)/g;
    let text = document.getText(range);
    let bindex = clean(brackets.exec(text));
    let sindex = clean(separator.exec(text));
    while (true) {
        if (sindex === undefined && bindex === undefined) {
            break;
        }
        else if (sindex === undefined && bindex !== undefined) {
            yield [bindex + range.start.character, Token.Bracket];
            bindex = clean(brackets.exec(text));
        }
        else if (sindex !== undefined && bindex === undefined) {
            yield [sindex + range.start.character, Token.Separator];
            sindex = clean(separator.exec(text));
        }
        else if (sindex !== undefined && bindex !== undefined) {
            if (sindex > bindex) {
                yield [bindex + range.start.character, Token.Bracket];
                bindex = clean(brackets.exec(text));
            }
            else {
                yield [sindex + range.start.character, Token.Separator];
                sindex = clean(separator.exec(text));
            }
        }
    }
    return;
}
function rangeFrom(document, pos) {
    let end = document.lineAt(pos).range.end;
    return new vscode.Range(pos, end);
}
function rangeTo(document, pos) {
    return new vscode.Range(new vscode.Position(pos.line, 0), pos);
}
function posToArgBoundary(editor, value, start, boundary) {
    return __awaiter(this, void 0, void 0, function* () {
        // find range of brackets
        editor.selection = new vscode.Selection(start, start);
        // pos: tracks the current search position
        let pos = new vscode.Position(start.line, start.character);
        // range: determined the bounds of the search
        let range = yield findSurroundingBracketRange(editor, pos);
        let doc = editor.document;
        let dir = value > 0 ? Direction.Forward : Direction.Backward;
        // count: tracks how many function arguments we've passed by
        let count = 0;
        // goal: the goal value for count
        let goal = Math.abs(value);
        // startLine: line we started searching
        let startLine = pos.line - 1;
        // keep going until we reach our goal or there are no more lines to search
        while (count < goal) {
            // get current line
            let line;
            if (startLine === pos.line) {
                // update position to new line, if needed
                if (dir === Direction.Forward) {
                    pos = new vscode_1.Position(pos.line + 1, 0);
                }
                else {
                    pos = new vscode_1.Position(pos.line - 1, doc.lineAt(pos.translate(-1, 0)).range.end.character);
                }
            }
            else {
                startLine = pos.line;
            }
            // use the position to find the line range we want
            if (dir === Direction.Forward) {
                line = range.intersection(rangeFrom(doc, pos));
            }
            else {
                line = range.intersection(rangeTo(doc, pos));
            }
            // if the new line is outside the range we're searching in
            // we're done
            if (line === undefined) {
                break;
            }
            // go through the tokens, counting separators
            let tokens = separatorsAndBrackets(doc, line, dir);
            for (let [index, token] of tokens) {
                // if we've moved to a new line, stop getting tokens on this line
                if (pos.line !== startLine || count === goal) {
                    break;
                }
                // if this token occurs after the search start...
                if (dir === Direction.Forward ?
                    pos.character <= index : pos.character >= index) {
                    if (token === Token.Separator) {
                        // if we found a new separator, move to it
                        // and increment the count
                        pos = new vscode_1.Position(pos.line, index);
                        count++;
                    }
                    else if (token === Token.Bracket) {
                        // if it's a bracket, move to the closing bracket
                        pos = yield findMatchingBracket(editor, new vscode_1.Position(pos.line, index));
                    }
                }
            }
        }
        if (count < goal) {
            if (dir === Direction.Forward) {
                pos = range.end;
            }
            else {
                pos = range.start;
            }
        }
        else if (count === goal) {
            // default motions move to end of argument,
            // move past separator and space, if that's where we landed
            // (we special case the end and start of the argument range)
            if (boundary === Boundary.Start) {
                if ((dir === Direction.Forward && !pos.isEqual(range.end)) ||
                    (dir === Direction.Backward && !pos.isEqual(range.start))) {
                    // move past the separator and spaces
                    let word = doc.getWordRangeAtPosition(pos.translate(0, 1), /\s+/);
                    if (word !== undefined) {
                        pos = word.end;
                    }
                    else if (pos.line < range.end.line) {
                        pos = new vscode_1.Position(pos.line + 1, doc.lineAt(pos.translate(1, 0)).firstNonWhitespaceCharacterIndex);
                    }
                    else {
                        pos = pos.translate(0, 1);
                    }
                }
            }
        }
        return pos;
    });
}
var Boundary;
(function (Boundary) {
    Boundary[Boundary["Start"] = 0] = "Start";
    Boundary[Boundary["End"] = 1] = "End";
    Boundary[Boundary["Both"] = 2] = "Both";
})(Boundary || (Boundary = {}));
function moveByArgument(editor, args) {
    return __awaiter(this, void 0, void 0, function* () {
        // copy current selections
        let value = args.value === undefined ? 1 : args.value;
        let starts = editor.selections.map(sel => new vscode.Selection(sel.anchor, sel.active));
        let boundary = args.boundary === undefined ?
            (args.selectWhole ? Boundary.Both : Boundary.Start) :
            args.boundary === 'end' ? Boundary.End :
                args.boundary === 'both' ? Boundary.Both :
                    Boundary.Start;
        if (!args.selectWhole) {
            let results = [];
            if (boundary === Boundary.Both) {
                vscode.window.showErrorMessage("Boundary value of 'both' is " +
                    "unsupported when 'selectWhole' is false.");
            }
            else {
                for (let i = 0; i < starts.length; i++) {
                    results[i] =
                        yield posToArgBoundary(editor, value, starts[i].active, boundary);
                    // expand motion goal if we didn't move at all
                    if (results[i].isEqual(starts[i].active)) {
                        value += Math.sign(value);
                        results[i] =
                            yield posToArgBoundary(editor, value, starts[i].active, boundary);
                    }
                }
                if (args.select) {
                    editor.selections = starts.map((sel, i) => new vscode.Selection(sel.anchor, results[i]));
                }
                else {
                    editor.selections = results.map(x => new vscode.Selection(x, x));
                }
            }
        }
        else {
            let newSels = [];
            let startBoundary = boundary !== Boundary.Both ? boundary :
                value > 0 ? Boundary.Start : Boundary.End;
            let stopBoundary = boundary !== Boundary.Both ? boundary :
                value > 0 ? Boundary.End : Boundary.Start;
            for (let i = 0; i < starts.length; i++) {
                let stop = yield posToArgBoundary(editor, value, starts[i].active, stopBoundary);
                let start = yield posToArgBoundary(editor, -Math.sign(value), stop, startBoundary);
                if (start.isEqual(stop)) {
                    start = yield posToArgBoundary(editor, -2 * Math.sign(value), stop, startBoundary);
                }
                let pos = new vscode.Selection(start, stop);
                if (pos.isEqual(starts[i])) {
                    stop = yield posToArgBoundary(editor, value + Math.sign(value), starts[i].active, stopBoundary);
                    start = yield posToArgBoundary(editor, -Math.sign(value), stop, startBoundary);
                    if (start.isEqual(stop)) {
                        start = yield posToArgBoundary(editor, -2 * Math.sign(value), stop, startBoundary);
                    }
                }
                newSels[i] = new vscode.Selection(start, stop);
            }
            editor.selections = newSels;
        }
    });
}
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;


/***/ }),

/***/ "vscode":
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("vscode");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/extension.ts");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=main.js.map