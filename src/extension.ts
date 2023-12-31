import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { findBibliography, findPaperMarkdown } from './files';
import { fixAstroJournalMacros, MAPPINGS } from './bib';

// The path to the local checkout of the inara repository. This includes all the
// resources needed to build the PDF.
const inaraRoot = path.resolve(`${__dirname}/../inara`);

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

// This is the main function for building the PDF using pandoc and inara.
async function _build(fmt: string) {
	const paper = await findPaperMarkdown();
	if (!paper) {
		return;
	}
	const paperDir = path.dirname(paper);
	const artifact = fmt === "preprint" ? `${paperDir}/paper.${fmt}.tex` : `${paperDir}/paper.${fmt}`;

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
		`--defaults='${inaraRoot}/data/defaults/${fmt}.yaml'`,
		`--defaults='${inaraRoot}/resources/${journal}/defaults.yaml'`,
		`--resource-path='${inaraRoot}':'${inaraRoot}/resources':'${paperDir}'`,
		`--metadata=article-info-file='${inaraRoot}/resources/default-article-info.yaml'`,
		`--variable=${journal}`,
		`--output='${artifact}'`,
		`'${paper}'`
	];

	// Set up the output channel for this extension and echo the command line.
	const outputChannel = getOutputChannel();
	outputChannel.clear();
	outputChannel.append(`Building ${paper} with command:\n`);
	outputChannel.append(`'${pandoc}' ${args.join(' ')}\n\nOutput:\n\n`);

	// The status bar will display the current state of the build.
	const statusBarItem = getStatusBarItem();
	statusBarItem.show();

	// Spawn the pandoc process.
	const proc = spawn(
		`'${pandoc}'`,
		args,
		{
			shell: true,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			env: { ...process.env, INARA_ARTIFACTS_PATH: paperDir }
		}
	);

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
			vscode.window.showInformationMessage("Inara: Build succeeded.", "Open Artifact", "Open Logs")
				.then((choice) => {
					if (choice === "Open Artifact") {
						vscode.commands.executeCommand('vscode.open', vscode.Uri.file(`${artifact}`));
					} else if (choice === "Open Logs") {
						displayLogs();
					}
				});
		} else {
			const message = `Build failed with error code ${code}.`;
			outputChannel.append(`\n${message}\n`);
			vscode.window.showErrorMessage(`Inara: ${message}`, "Open Logs")
				.then((choice) => {
					if (choice === "Open Logs") {
						displayLogs();
					}
				});
		}
	});

	return proc;
}

// This function will display the build logs.
function displayLogs() {
	getOutputChannel().show();
}

// Fix any astronomy journal references in the bibliography.
async function fixBibliography() {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !editor.document || path.extname(editor.document.fileName) !== '.bib') {
		const bib = await findBibliography();
		if (bib) {
			vscode.window.showTextDocument(vscode.Uri.file(bib)).then(_fixBibliography);
		}
		return;
	}
	_fixBibliography(editor);
}

function _fixBibliography(editor: vscode.TextEditor) {
	const document = editor.document;
	let selection: vscode.Selection | vscode.Range = editor.selection;
	if (selection.isEmpty) {
		selection = new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end);
	}
	const text = document.getText(selection);
	const updated = fixAstroJournalMacros(text);
	if (updated === text) {
		return;
	}
	editor.edit(editBuilder => {
		editBuilder.replace(selection, updated);
	});
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildPDF', async () => _build('pdf')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildJATS', async () => _build('jats')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildHTML', async () => _build('html')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildCrossref', async () => _build('crossref')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildCFF', async () => _build('cff')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.buildPreprint', async () => _build('preprint')));
	context.subscriptions.push(vscode.commands.registerCommand('inara.displayLogs', displayLogs));
	context.subscriptions.push(vscode.commands.registerCommand('inara.fixBibliography', fixBibliography));
}

export function deactivate() { }
