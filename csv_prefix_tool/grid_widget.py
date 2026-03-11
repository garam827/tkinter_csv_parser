import csv
import io
import tkinter as tk
from tkinter import messagebox
import pandas as pd


class CSVGrid(tk.Frame):
    DEFAULT_ROWS = 10
    DEFAULT_COLS = 6

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self._rows = self.DEFAULT_ROWS
        self._cols = self.DEFAULT_COLS
        self._cells = {}  # (row, col) -> Entry
        self._focused = (0, 0)
        self._build_grid()

    def _build_grid(self):
        for widget in self.winfo_children():
            widget.destroy()
        self._cells = {}
        for r in range(self._rows):
            for c in range(self._cols):
                entry = tk.Entry(self, width=12, relief=tk.SOLID, borderwidth=1)
                entry.grid(row=r, column=c, padx=1, pady=1, sticky="nsew")
                entry.bind("<FocusIn>", lambda e, row=r, col=c: self._on_focus(row, col))
                entry.bind("<Control-v>", self._on_paste)
                entry.bind("<Control-V>", self._on_paste)
                self._cells[(r, c)] = entry
        for c in range(self._cols):
            self.columnconfigure(c, weight=1)

    def _on_focus(self, row, col):
        self._focused = (row, col)

    def _on_paste(self, event):
        try:
            clipboard = self.winfo_toplevel().clipboard_get()
        except tk.TclError:
            messagebox.showerror("붙여넣기 오류", "클립보드가 비어있습니다.")
            return "break"

        if not clipboard.strip():
            messagebox.showerror("붙여넣기 오류", "클립보드가 비어있습니다.")
            return "break"

        rows = self._parse_clipboard(clipboard)
        if rows is None:
            return "break"

        start_r, start_c = self._focused
        max_r = start_r + len(rows)
        max_c = start_c + max(len(row) for row in rows)

        if max_r > self._rows or max_c > self._cols:
            self._expand(max(max_r, self._rows), max(max_c, self._cols))

        for dr, row_data in enumerate(rows):
            for dc, val in enumerate(row_data):
                cell = self._cells.get((start_r + dr, start_c + dc))
                if cell:
                    cell.delete(0, tk.END)
                    cell.insert(0, val)

        return "break"

    def _parse_clipboard(self, text):
        for delimiter in ["\t", ",", ";"]:
            try:
                reader = csv.reader(io.StringIO(text), delimiter=delimiter)
                rows = list(reader)
                if rows and (len(rows) > 1 or len(rows[0]) > 1):
                    return rows
            except Exception:
                continue
        # fallback: single column
        lines = text.splitlines()
        if lines:
            return [[line] for line in lines]
        messagebox.showerror("붙여넣기 오류", "클립보드 데이터를 파싱할 수 없습니다.")
        return None

    def _expand(self, new_rows, new_cols):
        old_data = {}
        for (r, c), entry in self._cells.items():
            old_data[(r, c)] = entry.get()
        self._rows = new_rows
        self._cols = new_cols
        self._build_grid()
        for (r, c), val in old_data.items():
            cell = self._cells.get((r, c))
            if cell and val:
                cell.insert(0, val)

    def get_dataframe(self):
        data = []
        for r in range(self._rows):
            row = [self._cells[(r, c)].get() for c in range(self._cols)]
            if any(v.strip() for v in row):
                data.append(row)
        if not data:
            return pd.DataFrame()
        return pd.DataFrame(data)

    def clear(self):
        for entry in self._cells.values():
            entry.delete(0, tk.END)

    def add_row(self):
        self._expand(self._rows + 1, self._cols)

    def delete_row(self):
        if self._rows <= 1:
            return
        old_data = {}
        for (r, c), entry in self._cells.items():
            old_data[(r, c)] = entry.get()
        self._rows -= 1
        self._build_grid()
        for (r, c), val in old_data.items():
            if r < self._rows:
                cell = self._cells.get((r, c))
                if cell and val:
                    cell.insert(0, val)

    def add_col(self):
        self._expand(self._rows, self._cols + 1)

    def delete_col(self):
        if self._cols <= 1:
            return
        old_data = {}
        for (r, c), entry in self._cells.items():
            old_data[(r, c)] = entry.get()
        self._cols -= 1
        self._build_grid()
        for (r, c), val in old_data.items():
            if c < self._cols:
                cell = self._cells.get((r, c))
                if cell and val:
                    cell.insert(0, val)
