import * as vscode from 'vscode';
import { resolve, basename, dirname } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

// The path to the local checkout of the inara repository. This includes all the
// resources needed to build the PDF.
const inaraRoot = resolve(`${__dirname}/../inara`);

// This status bar item used to display the build status
let _statusBarItem: vscode.StatusBarItem;
function getStatusBarItem(): vscode.StatusBarItem {
	if (!_statusBarItem) {
		_statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		_statusBarItem.text = "Inara: Building...";
		_statusBarItem.command = "inara.displayLogs";
	}
	return _statusBarItem;
}

// This output channel is used to display the build logs
let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Inara');
	}
	return _channel;
}

// Functions to find a 'paper.md' file within this workspace. It will return the
// current file if it is called 'paper.md', otherwise it will search for the
// first 'paper.md' returned by 'vscode.workspace.findFiles'. What happens if
// there are multiple 'paper.md' files in the workspace? I don't know if the
// results are deterministic!
async function _findPaperMarkdown() {
	if (vscode.window.activeTextEditor) {
		const currentDoc = vscode.window.activeTextEditor.document.uri;
		if (basename(currentDoc.path) === 'paper.md') {
			return currentDoc;
		}
	}
	const uris = await vscode.workspace.findFiles("**/paper.md", null, 1);
	if (uris.length > 0) {
		return uris[0];
	}
}

async function findPaperMarkdown() {
	let paper = await _findPaperMarkdown();
	if (!paper) {
		vscode.window.showErrorMessage('Inara: No paper.md file found in the workspace.');
		return;
	}
	if (paper.scheme !== 'file') {
		vscode.window.showErrorMessage('Inara: The paper.md file must be local.');
		return;
	}
	return paper;
}

// This is the main function for building the PDF using pandoc and inara.
async function buildPDF() {
	let paper = await findPaperMarkdown();
	if (!paper) {
		return;
	}

	// Get the configuration settings for this extension.
	const pandoc = vscode.workspace.getConfiguration("inara").get("pandoc", "pandoc");
	const journal = vscode.workspace.getConfiguration("inara").get("journal", "joss");
	if (journal !== "joss" && journal !== "jose") {
		vscode.window.showErrorMessage("Inara: The journal must be either 'joss' or 'jose'.");
		return;
	}

	// Construct the command line arguments for pandoc.
	const args = [
		`--data-dir='${inaraRoot}/data'`,
		`--defaults=shared`,
		`--defaults='${inaraRoot}/data/defaults/pdf.yaml'`,
		`--defaults='${inaraRoot}/resources/${journal}/defaults.yaml'`,
		`--resource-path='${inaraRoot}':'${inaraRoot}/resources':'${dirname(paper.path)}'`,
		`--metadata=article-info-file='${inaraRoot}/resources/default-article-info.yaml'`,
		`--variable=${journal}`,
		`--output='${dirname(paper.fsPath)}/paper.pdf'`,
		`'${paper.fsPath}'`
	];

	// Set up the output channel for this extension and echo the command line.
	const outputChannel = getOutputChannel();
	outputChannel.clear();
	outputChannel.append(`Building ${paper.fsPath} with command:\n`);
	outputChannel.append(`'${pandoc}' ${args.join(' ')}\n\nOutput:\n\n`);

	// The status bar will display the current state of the build.
	const statusBarItem = getStatusBarItem();
	statusBarItem.show();

	// Spawn the pandoc process.
	const proc = spawn(`'${pandoc}'`, args, { shell: true });

	// Stdout and stderr are both sent to the output channel.
	proc.stdout.setEncoding("utf8");
	proc.stdout.on("data", (data) => {
		outputChannel.append(data.toString());
	});
	proc.stderr.setEncoding("utf8");
	proc.stderr.on("data", (data) => {
		outputChannel.append(data.toString());
	});

	// After the run, a message is displayed with the .
	proc.on("exit", (code, _) => {
		statusBarItem.hide();
		if (code === 0) {
			outputChannel.append("\nBuild succeeded.\n");
			vscode.window.showInformationMessage("Inara: Build succeeded.", "Show PDF", "Show Logs")
				.then((choice) => {
					if (choice === "Show PDF") {
						displayPDF(paper);
					} else if (choice === "Show Logs") {
						displayLogs();
					}
				});
		} else {
			const message = `Build failed with error code ${code}.`;
			outputChannel.append(`\n${message}\n`);
			vscode.window.showErrorMessage(`Inara: ${message}`, "Show Logs")
				.then((choice) => {
					if (choice === "Show Logs") {
						displayLogs();
					}
				});
		}
	});

	return proc;
}

// This function will display the PDF corresponding to the current paper.md file.
async function displayPDF(paper?: vscode.Uri) {
	if (!paper) {
		paper = await findPaperMarkdown();
		if (!paper) {
			return;
		}
	}
	const pdf = `${dirname(paper.fsPath)}/paper.pdf`;
	if (!existsSync(pdf)) {
		vscode.window.showErrorMessage(`Inara: No corresponding PDF found for ${paper.fsPath}.`);
		return;
	}
	vscode.commands.executeCommand('vscode.open', vscode.Uri.file(pdf));
}

// This function will display the build logs.
function displayLogs() {
	getOutputChannel().show();
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildPDF', buildPDF));
	context.subscriptions.push(vscode.commands.registerCommand('inara.displayPDF', displayPDF));
	context.subscriptions.push(vscode.commands.registerCommand('inara.displayLogs', displayLogs));
}

export function deactivate() { }
