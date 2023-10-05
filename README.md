# vscode-inara

A VSCode extension for authors and editors of [The Journal of Open Source
Software (JOSS)](https://joss.theoj.org/) and [The Journal of Open Source
Education (JOSE)](https://jose.theoj.org/). This extension provides a number of
custom commands for interacting with
[inara](https://github.com/openjournals/inara), the tool used to generating
JOSS and JOSE publishing artifacts.

## Requirements

To use this extension, you'll need to install [Pandoc](https://pandoc.org) and,
if you want to generate PDFs, a LaTeX distribution (e.g. [TeX
Live](https://www.tug.org/texlive) or [TinyTeX](https://yihui.org/tinytex)). If
`pandoc` is not discoverable on your `PATH`, you can provide a custom executable
using the `inara.pandoc` configuration variable.

## Features

This extension provides a number of new VSCode commands to help with authoring
and editorial tasks for JOSS and JOSE. For example, when you have a VSCode
workspace open within a JOSS/JOSE project, you can open the command palette
(`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS) and execute the
`Inara: Build PDF` command to build the PDF for your manuscript. Similar
commands are available for all other output targets supported by inara.

This extension also provides a command for fixing a common issue with the
bibliographies of submissions in the domain of Astronomy and Astrophysics. Since
the TeX templates used by JOSS and JOSE don't support the journal macros
commonly used in that domain, you can use the `Inara: Fix astronomy journal
references` command to expand these macros in your `.bib` file.

## Extension Settings

- `inara.pandoc`: The path to a custom pandoc executable.
- `inara.journal`: The journal identifier; must be `joss` or `jose`.
