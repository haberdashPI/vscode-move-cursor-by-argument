// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Range, Position } from 'vscode';
import { setFlagsFromString } from 'v8';
import { Dir } from 'fs';

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
        range = new vscode.Range(editor.selection.start,editor.selection.end);
    }else{
        await vscode.commands.executeCommand('editor.action.selectToBracket');
        range = new vscode.Range(editor.selection.start,editor.selection.end);
    }

    return range;
}

function textLineFrom(editor: vscode.TextEditor, pos: vscode.Position,
    range: vscode.Range){

    let end = editor.document.lineAt(pos).range.end;
    if(end.isAfter(range.end)){ end = range.end; }
    return editor.document.getText(new Range(pos,end));
}

function noMatch(match: RegExpExecArray | null){
    return match === null || match.index === undefined;
}
function isBefore(a: RegExpExecArray | null, b: RegExpExecArray | null){
    if(a === null || a.index === undefined){
        return false
    }
    return b === null || b.index === undefined || a.index < b.index;
}

function nonZeroIndex(m: RegExpExecArray | null){
    return m !== null && m.index !== undefined && m.index > 0;
}

async function moveSelByArgument(editor: vscode.TextEditor, args: MoveByArgs,
    sel: vscode.Selection) {

    // find range of brackets
    editor.selection = sel;

    let pos = new vscode.Position(sel.active.line,sel.active.character);
    let brackets = bracketsFor(editor.document,Direction.Forward);
    let separator = /(,|;)/g;
    let range = await findSurroundingBracketRange(editor,pos);

    if(args.value > 0){
        let count = 0;
        let text = textLineFrom(editor,pos,range);

        let firstBracket = brackets.exec(text);
        let firstSeparator = separator.exec(text);
        let offset = pos.character;

        // TODO: in progress cleanup below with functions
        // I don't like my current approach of this tiny functions
        // re-checking null, do something else
        while(count < args.value && pos.isBefore(range.end.translate(0,-1))){
            if(noMatch(firstSeparator)){
                if(pos.line < range.end.line){
                    pos = new Position(pos.line+1,0);
                    text = textLineFrom(editor,pos,range);
                    brackets.lastIndex = 0;
                    separator.lastIndex = 0;
                    offset = pos.character;

                    firstSeparator = separator.exec(text);
                    firstBracket = brackets.exec(text);
                }else{
                    pos = range.end.translate(0,-1);
                }
            }else if(isBefore(firstSeparator,firstBracket)){
                if(nonZeroIndex(firstSeparator)){
                    count++;
                    pos = new Position(pos.line,offset + firstSeparator.index);
                    offset = 0;
                    firstSeparator = separator.exec(text);
                }else{
                    firstSeparator = separator.exec(text);
                }
            }else{
                let at = new Position(pos.line,offset + firstBracket.index);
                editor.selection = new vscode.Selection(at,at);
                let cmdval = await vscode.commands.executeCommand('editor.action.jumpToBracket');
                firstBracket = brackets.exec(text);
                if(editor.selection.active.line > pos.line){
                    pos = editor.selection.active;
                    end = editor.document.lineAt(pos).range.end;
                    if(end.isAfter(range.end)){ end = range.end; }
                    text = editor.document.getText(new Range(pos,end));
                    brackets.lastIndex = 0;
                    separator.lastIndex = 0;
                    offset = pos.character;

                    firstSeparator = separator.exec(text);
                    firstBracket = brackets.exec(text);
                }else{
                    pos = editor.selection.active;
                }
                while(firstSeparator !== null &&
                      firstSeparator.index+offset < pos.character){
                    firstSeparator = separator.exec(text);
                }
                while(firstBracket !== null &&
                      firstBracket.index+offset < pos.character){
                    firstBracket = brackets.exec(text);
                }

            }
        }
        return new vscode.Selection(pos,pos);
    }else{
        return sel;
        // TODO: reverse search order
    }
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
