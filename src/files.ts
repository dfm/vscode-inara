import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

// This function finds a 'paper.md' file within this workspace. It will return
// the current file if it is called 'paper.md', otherwise it will search for the
// first 'paper.md' returned by 'vscode.workspace.findFiles'. What happens if
// there are multiple 'paper.md' files in the workspace? I don't know if the
// results are deterministic!
export async function findPaperMarkdown() {
    let paper = await _findPaperMarkdown();
    if (!paper) {
        vscode.window.showErrorMessage('Inara: No paper.md file found in the workspace.');
        return;
    }
    if (paper.scheme !== 'file') {
        vscode.window.showErrorMessage('Inara: The paper.md file must be local.');
        return;
    }
    return paper.fsPath;
}

async function _findPaperMarkdown() {
    if (vscode.window.activeTextEditor) {
        const currentDoc = vscode.window.activeTextEditor.document.uri;
        if (path.basename(currentDoc.path) === 'paper.md') {
            return currentDoc;
        }
    }
    const uris = await vscode.workspace.findFiles("**/paper.md", null, 1);
    if (uris.length > 0) {
        return uris[0];
    }
}

export async function findBibliography() {
    let bib = await _findBibliography();
    if (!bib) {
        vscode.window.showErrorMessage('Inara: No bibliography found in the workspace.');
        return;
    }
    return bib;
}

async function _findBibliography() {
    // If we're editing a .bib file, use that.
    if (vscode.window.activeTextEditor) {
        const currentDoc = vscode.window.activeTextEditor.document.uri;
        if (path.extname(currentDoc.path) === '.bib') {
            return currentDoc.fsPath;
        }
    }

    // Otherwise, search read the bibliography reference from the paper.md file.
    let paper = await _findPaperMarkdown();
    if (!paper) {
        return;
    }

    // Read the paper.md file and search for the bibliography reference.
    const text = fs.readFileSync(paper.fsPath, { encoding: 'utf8' });
    const regex = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;
    const result = regex.exec(text);
    if (!result || result.length < 3) {
        vscode.window.showErrorMessage('Inara: Could not extract YAML frontmatter from paper.md.');
        return;
    }

    // Parse the YAML frontmatter.
    const data = YAML.parse(result[2]);
    if (!data || !data.bibliography) {
        vscode.window.showErrorMessage('Inara: YAML frontmatter in paper.md does not include a bibliography.');
        return;
    }

    return path.join(path.dirname(paper.fsPath), data.bibliography);
}
