import tkinter as tk


class OutputPanel(tk.Frame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        tk.Label(self, text="Output Preview", anchor="w").pack(fill=tk.X)
        frame = tk.Frame(self)
        frame.pack(fill=tk.BOTH, expand=True)
        scrollbar = tk.Scrollbar(frame, orient=tk.VERTICAL)
        self._text = tk.Text(
            frame, height=8, state=tk.DISABLED,
            yscrollcommand=scrollbar.set, wrap=tk.NONE
        )
        scrollbar.config(command=self._text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def set_text(self, content):
        self._text.config(state=tk.NORMAL)
        self._text.delete("1.0", tk.END)
        self._text.insert("1.0", content)
        self._text.config(state=tk.DISABLED)
