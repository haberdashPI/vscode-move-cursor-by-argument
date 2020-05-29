// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Range, Position } from 'vscode';
import { setFlagsFromString } from 'v8';
import { Dir } from 'fs';
import { schedulingPolicy } from 'cluster';

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
    languageBrackets["default"] = {start: /(\(|\{|\[)/, stop: /(\]|\}|\))/ }
}
function bracketsFor(doc: vscode.TextDocument,dir: Direction){
    if(dir === Direction.Forward){
        return RegExp(languageBrackets["default"].start,"g");
    }else{
        return RegExp(languageBrackets["default"].stop,"g");
    }
}

interface MoveByArgs{
    value: number,
    select: boolean
}

enum Direction{
    Forward,
    Backward
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // TODO: create a way to define regex's in settings.json
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
        range = new vscode.Range(editor.selection.start,
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
    while(bindex !== undefined && sindex !== undefined){
        if(sindex === undefined){
            yield [bindex+range.start.character, Token.Bracket];
        }else if(bindex === undefined){
            yield [sindex+range.start.character, Token.Separator];
        }else if(sindex < bindex){
            yield [sindex+range.start.character, Token.Separator];
        }else{
            yield [bindex+range.start.character, Token.Bracket];
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

async function moveSelByArgument(editor: vscode.TextEditor, args: MoveByArgs,
    sel: vscode.Selection) {

    // find range of brackets
    editor.selection = sel;

    // pos: tracks the current search position, starts at the current selection
    let pos = new vscode.Position(sel.active.line,sel.active.character);
    // range: determined the bounds of the search
    let range = await findSurroundingBracketRange(editor,pos);

    let doc = editor.document;

    let dir = args.value > 0 ? Direction.Forward : Direction.Backward;
    // count: tracks how many function arguments we've passed by
    let count = 0;
    // line: the current range (a single line) we're searching
    let line = args.value > 0 ? range.intersection(rangeFrom(doc,pos)) :
        range.intersection(rangeTo(doc,pos));
    // goal: the goal value for count
    let goal = Math.abs(args.value);

    // keep going until we reach our goal or there are no more lines to search
    while(count < goal && line !== undefined){

        // startLine: line we started searching
        let startLine = pos.line;
        let tokens = separatorsAndBrackets(doc, line, dir);

        // go through the tokens...
        for(let [index, token] of tokens){
            // if we've moved to a new line, stop getting tokens on this line
            if(pos.line !== startLine){ break; }
            // if this token occurs after the search start...
            if(args.value > 0 ? pos.character <= index : pos.character >= index){
                if(token === Token.Separator){
                    // if we found a new separator, move to it
                    // and increment the count
                    if(pos.character !== index){
                        pos = new Position(pos.line,index);
                        count++;
                    }
                }else if(token === Token.Bracket){
                    // if it's a bracket, move to the closing bracket
                    pos = await findMatchingBracket(editor,
                            new Position(pos.line,index));
                }
            }
        }

        // after finishing the current line, move to the next one
        line = range.intersection(rangeFrom(doc, new Position(pos.line+1,0)));
    }
    return new vscode.Selection(pos,pos);
}

async function moveByArgument(editor: vscode.TextEditor, args: MoveByArgs){
    // copy current selections
    let starts = editor.selections.map(sel =>
        new vscode.Selection(sel.anchor,sel.active));
    let results: vscode.Selection[] = [];
    for(let i=0;i<starts.length;i++){
        results[i] = await moveSelByArgument(editor,args,starts[i]);
    }
    editor.selections = results;
}

// this method is called when your extension is deactivated
export function deactivate() {}
