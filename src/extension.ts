// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Range, Position } from 'vscode';

interface IHash<T> {
    [details: string] : T;
}
interface BracketPair{
    start: RegExp,
    stop: RegExp,
}
let languageBrackets: IHash<BracketPair> = {};

function findBrackets(){
    // TODO: compute brackets based on the language configuration
    languageBrackets["default"] = {start: /(\(|\{|\[)/, stop: /(\]|\}|\))/ };
}
function bracketsFor(doc: vscode.TextDocument,dir: Direction){
    if(dir === Direction.Forward){
        return RegExp(languageBrackets["default"].start,"g");
    }else{
        return RegExp(languageBrackets["default"].stop,"g");
    }
}

interface MoveByArgs{
    value?: number,
    select?: boolean
    boundary?: string,
    selectWhole?: boolean,
}

enum Direction{
    Forward,
    Backward
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    findBrackets();
    vscode.workspace.onDidChangeConfiguration(findBrackets);


    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "move-cursor-by-argument" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('move-cursor-by-argument.move-by-argument',
        (args: MoveByArgs) => {
            let editor = vscode.window.activeTextEditor;
            if(editor){
                moveByArgument(editor,args);
                editor.revealRange(editor.selection);
            }
        });

    context.subscriptions.push(disposable);
}

async function findSurroundingBracketRange(editor: vscode.TextEditor,
    pos: vscode.Position){

    // if we're right after a bracket, this will
    // select that inner range, rather than the outer range
    // we need to shift the cursor first, in this case,
    let endbracket = bracketsFor(editor.document,Direction.Backward);
    let charbefore =
        editor.document.getText(new Range(pos.translate(0,-1),pos));
    let range: vscode.Range;
    if(endbracket.test(charbefore)){
        let next = pos.translate(0,1);
        editor.selection = new vscode.Selection(next,next);
        await vscode.commands.executeCommand('editor.action.selectToBracket');
        range = new vscode.Range(editor.selection.start,
            editor.selection.end.translate(0,-1));
    }else{
        await vscode.commands.executeCommand('editor.action.selectToBracket');
        range = new vscode.Range(editor.selection.start.translate(0,1),
            editor.selection.end.translate(0,-1));
    }

    return range;
}

function textLineFrom(editor: vscode.TextEditor, pos: vscode.Position,
    range: vscode.Range){

    let end = editor.document.lineAt(pos).range.end;
    if(end.isAfter(range.end)){ end = range.end; }
    return editor.document.getText(new Range(pos,end));
}

function isBefore(a: number | undefined, b: number | undefined){
    if(a === undefined){
        return false;
    }else{
        return b === undefined || a < b;
    }
}

function nonZeroIndex(m: RegExpExecArray | null){
    return m !== null && m.index !== undefined && m.index > 0;
}

function clean(match: RegExpExecArray | null){
    if(match === null || match.index === undefined){
        return undefined;
    }else{
        return match.index;
    }
}

enum Token{
    Separator,
    Bracket
}

async function findMatchingBracket(editor: vscode.TextEditor, pos: vscode.Position){
    editor.selection = new vscode.Selection(pos,pos);
    await vscode.commands.executeCommand('editor.action.jumpToBracket');
    return editor.selection.active;
}

function separatorsAndBrackets(document: vscode.TextDocument, range: vscode.Range, dir: Direction){
    let tokens = _separatorsAndBrackets(document, range, dir);

    if(dir === Direction.Forward){
        return tokens;
    }else{
        return Array.from(tokens).reverse();
    }
}
function* _separatorsAndBrackets(document: vscode.TextDocument, range: vscode.Range, dir: Direction){
    let brackets = bracketsFor(document,dir);
    let separator = /(,|;)/g;

    let text = document.getText(range);
    let bindex = clean(brackets.exec(text));
    let sindex = clean(separator.exec(text));
    while(true){
        if(sindex === undefined && bindex === undefined){
            break;
        }else if(sindex === undefined && bindex !== undefined){
            yield [bindex+range.start.character, Token.Bracket];
            bindex = clean(brackets.exec(text));
        }else if(sindex !== undefined && bindex === undefined){
            yield [sindex+range.start.character, Token.Separator];
            sindex = clean(separator.exec(text));
        }else if(sindex !== undefined && bindex !== undefined){
            if(sindex > bindex){
                yield [bindex+range.start.character, Token.Bracket];
                bindex = clean(brackets.exec(text));
            } else{
                yield [sindex+range.start.character, Token.Separator];
                sindex = clean(separator.exec(text));
            }
        }
    }
    return;
}

function rangeFrom(document: vscode.TextDocument, pos: vscode.Position){
    let end = document.lineAt(pos).range.end;
    return new vscode.Range(pos,end);
}

function rangeTo(document: vscode.TextDocument, pos: vscode.Position){
    return new vscode.Range(new vscode.Position(pos.line,0),pos);
}

async function posToArgBoundary(editor: vscode.TextEditor, value: number,
    start: vscode.Position, boundary: Boundary) {

    // find range of brackets
    editor.selection = new vscode.Selection(start,start);

    // pos: tracks the current search position
    let pos = new vscode.Position(start.line,start.character);
    // range: determined the bounds of the search
    let range = await findSurroundingBracketRange(editor,pos);

    let doc = editor.document;

    let dir = value > 0 ? Direction.Forward : Direction.Backward;
    // count: tracks how many function arguments we've passed by
    let count = 0;
    // goal: the goal value for count
    let goal = Math.abs(value);
    // startLine: line we started searching
    let startLine = pos.line-1;

    // keep going until we reach our goal or there are no more lines to search
    while(count < goal){

        // get current line
        let line;
        if(startLine === pos.line){
            // update position to new line, if needed
            if(dir === Direction.Forward){
                pos = new Position(pos.line+1,0);
            }else{
                pos = new Position(pos.line-1,
                        doc.lineAt(pos.translate(-1,0)).range.end.character);
            }
        }
        else{
            startLine = pos.line;
        }

        // use the position to find the line range we want
        if(dir === Direction.Forward){
            line = range.intersection(rangeFrom(doc, pos));
        }else{
            line = range.intersection(rangeTo(doc, pos));
        }
        // if the new line is outside the range we're searching in
        // we're done
        if(line === undefined){ break; }

        // go through the tokens, counting separators
        let tokens = separatorsAndBrackets(doc, line, dir);

        for(let [index, token] of tokens){
            // if we've moved to a new line, stop getting tokens on this line
            if(pos.line !== startLine || count === goal){ break; }
            // if this token occurs after the search start...
            if(dir === Direction.Forward ?
               pos.character <= index : pos.character >= index){
                if(token === Token.Separator){
                    // if we found a new separator, move to it
                    // and increment the count
                    pos = new Position(pos.line,index);
                    count++;
                }else if(token === Token.Bracket){
                    // if it's a bracket, move to the closing bracket
                    pos = await findMatchingBracket(editor,
                            new Position(pos.line,index));
                }
            }
        }
    }
    if(count < goal){
        if(dir === Direction.Forward){
            pos = range.end;
        }else{
            pos = range.start;
        }
    }else if(count === goal){
        // default motions move to end of argument,
        // move past separator and space, if that's where we landed
        // (we special case the end and start of the argument range)
        if(boundary === Boundary.Start){
            if((dir === Direction.Forward && !pos.isEqual(range.end)) ||
               (dir === Direction.Backward && !pos.isEqual(range.start))){
                // move past the separator and spaces
                let word = doc.getWordRangeAtPosition(pos.translate(0,1),/\s+/);
                if(word !== undefined){
                    pos = word.end;
                }else if(pos.line < range.end.line){
                    pos = new Position(pos.line + 1,
                        doc.lineAt(pos.translate(1,0)).firstNonWhitespaceCharacterIndex);
                }else{
                    pos = pos.translate(0,1);
                }
            }
        }
    }
    return pos;
}

enum Boundary{
    Start,
    End,
    Both,
}

async function moveByArgument(editor: vscode.TextEditor, args: MoveByArgs){
    // copy current selections
    let value = args.value === undefined ? 1 : args.value;
    let starts = editor.selections.map(sel =>
        new vscode.Selection(sel.anchor,sel.active));
    let boundary = args.boundary === undefined ?
        (args.selectWhole ? Boundary.Both : Boundary.Start) :
        args.boundary === 'end' ? Boundary.End :
        args.boundary === 'both' ? Boundary.Both :
        Boundary.Start;
    if(!args.selectWhole){
        let results: vscode.Position[] = [];
        if(boundary === Boundary.Both){
            vscode.window.showErrorMessage("Boundary value of 'both' is "+
                "unsupported when 'selectWhole' is false.");
        }else{
            for(let i=0;i<starts.length;i++){
                results[i] =
                    await posToArgBoundary(editor,value,starts[i].active, boundary);
                // expand motion goal if we didn't move at all
                if(results[i].isEqual(starts[i].active)){
                    value += Math.sign(value);
                    results[i] =
                        await posToArgBoundary(editor,value,starts[i].active, boundary);
                }
            }
            if(args.select){
                editor.selections = starts.map((sel,i) =>
                    new vscode.Selection(sel.anchor,results[i])
                );
            }else{
                editor.selections = results.map(x => new vscode.Selection(x,x));
            }
        }
    }else{
        let newSels: vscode.Selection[] = [];
        let startBoundary = boundary !== Boundary.Both ? boundary :
            value > 0 ? Boundary.Start : Boundary.End;
        let stopBoundary = boundary !== Boundary.Both ? boundary :
            value > 0 ? Boundary.End : Boundary.Start;

        for(let i=0;i<starts.length;i++){
            let stop = await posToArgBoundary(editor,value,starts[i].active,
                stopBoundary);
            let start = await posToArgBoundary(editor,-Math.sign(value),
                stop, startBoundary);
            if(start.isEqual(stop)){
                start = await posToArgBoundary(editor,-2*Math.sign(value),
                    stop, startBoundary);
            }

            let pos = new vscode.Selection(start,stop);
            if(pos.isEqual(starts[i])){
                stop = await posToArgBoundary(editor,value+Math.sign(value),
                    starts[i].active, stopBoundary);
                start = await posToArgBoundary(editor,-Math.sign(value),
                    stop, startBoundary);
                if(start.isEqual(stop)){
                    start = await posToArgBoundary(editor,-2*Math.sign(value),
                        stop, startBoundary);
                }
            }
            newSels[i] = new vscode.Selection(start,stop);
        }
        editor.selections = newSels;
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}
