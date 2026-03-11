# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CSV Prefix Tool** — A Python/tkinter desktop app that lets users paste CSV data into a grid, prepend custom text, and export the combined output.

- Stack: Python 3.8+, tkinter (stdlib only, no external GUI libs), pandas
- Entry point: `python main.py`

## Running the App

```bash
pip install pandas
python main.py
```

## Architecture

The app is split across four modules under `csv_prefix_tool/`:

- **`main.py`** — Entry point. Creates `CSVPrefixApp` and calls `mainloop()`.
- **`app.py`** — `CSVPrefixApp(tk.Tk)`. Owns the top-level layout, prefix text widget, output preview widget, and three action buttons. Holds `self._last_output` for the most recently generated output string. Key methods: `generate_output()`, `save_to_file()`, `copy_to_clipboard()`.
- **`grid_widget.py`** — `CSVGrid(tk.Frame)`. A dynamic grid of `Entry` widgets (default 10 rows × 6 cols). Handles Ctrl+V paste with auto-delimiter detection (tab → comma → semicolon). Expands rows/columns automatically when pasted data exceeds current grid size. Key methods: `get_dataframe()` (returns pandas DataFrame, skipping fully-empty rows), `clear()`.
- **`output_panel.py`** — Output preview panel (read-only `tk.Text` + scrollbar). Used by `app.py`.

## Output Format

`generate_output()` produces:
```
<prefix text>
<CSV rows, comma-separated, no header, no index>
```
If prefix is empty, only CSV is output. If grid is empty, only prefix is output. If both are empty, show a warning popup.

## Key Behaviors

- Ctrl+V in the grid pastes clipboard content, auto-detecting the delimiter
- All user-facing errors use `messagebox.showerror`; success confirmations use `messagebox.showinfo`
- File save defaults to `.csv`, supports `.txt` and all files; cancelling the dialog is a no-op
- Minimum window size: 700×700
