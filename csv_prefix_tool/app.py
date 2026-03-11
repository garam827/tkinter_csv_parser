import io
import tkinter as tk
from tkinter import filedialog, messagebox

from grid_widget import CSVGrid
from output_panel import OutputPanel


class CSVPrefixApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CSV Prefix Tool")
        self.minsize(700, 700)
        self._last_output = None
        self._separator_var = tk.StringVar(value=",")
        self._build_ui()

    def _build_ui(self):
        self.rowconfigure(1, weight=2)
        self.rowconfigure(3, weight=1)
        self.rowconfigure(6, weight=2)
        self.columnconfigure(0, weight=1)

        # Title
        tk.Label(self, text="CSV Prefix Tool", font=("", 14, "bold")).grid(
            row=0, column=0, sticky="w", padx=10, pady=(10, 4)
        )

        # Separator selector
        sep_frame = tk.Frame(self)
        sep_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 2))
        tk.Label(sep_frame, text="구분자:").pack(side=tk.LEFT)
        for label, val in [("쉼표 (,)", ","), ("탭 (\\t)", "\t"), ("세미콜론 (;)", ";")]:
            tk.Radiobutton(
                sep_frame, text=label, variable=self._separator_var, value=val
            ).pack(side=tk.LEFT, padx=4)

        # CSV Grid
        grid_frame = tk.LabelFrame(self, text="CSV 데이터 입력")
        grid_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=4)
        grid_frame.columnconfigure(0, weight=1)

        self._grid = CSVGrid(grid_frame)
        self._grid.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)

        # Grid control buttons
        ctrl_frame = tk.Frame(grid_frame)
        ctrl_frame.grid(row=1, column=0, sticky="w", padx=4, pady=(0, 4))
        tk.Button(ctrl_frame, text="행 추가", command=self._grid.add_row).pack(side=tk.LEFT, padx=2)
        tk.Button(ctrl_frame, text="행 삭제", command=self._grid.delete_row).pack(side=tk.LEFT, padx=2)
        tk.Button(ctrl_frame, text="열 추가", command=self._grid.add_col).pack(side=tk.LEFT, padx=2)
        tk.Button(ctrl_frame, text="열 삭제", command=self._grid.delete_col).pack(side=tk.LEFT, padx=2)
        tk.Button(ctrl_frame, text="그리드 초기화", command=self._confirm_clear).pack(side=tk.LEFT, padx=8)

        # Prefix text
        tk.Label(self, text="Prefix Text (접두 문자열)", anchor="w").grid(
            row=3, column=0, sticky="w", padx=10, pady=(6, 0)
        )
        prefix_frame = tk.Frame(self)
        prefix_frame.grid(row=4, column=0, sticky="nsew", padx=10, pady=(0, 4))
        prefix_frame.columnconfigure(0, weight=1)
        prefix_scroll = tk.Scrollbar(prefix_frame, orient=tk.VERTICAL)
        self._prefix_text = tk.Text(prefix_frame, height=6, yscrollcommand=prefix_scroll.set)
        prefix_scroll.config(command=self._prefix_text.yview)
        prefix_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._prefix_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Action buttons
        btn_frame = tk.Frame(self)
        btn_frame.grid(row=5, column=0, sticky="w", padx=10, pady=6)
        tk.Button(btn_frame, text="출력 생성", width=14, command=self.generate_output).pack(side=tk.LEFT, padx=4)
        tk.Button(btn_frame, text="파일 저장", width=14, command=self.save_to_file).pack(side=tk.LEFT, padx=4)
        tk.Button(btn_frame, text="클립보드 복사", width=14, command=self.copy_to_clipboard).pack(side=tk.LEFT, padx=4)

        # Output preview
        self._output_panel = OutputPanel(self)
        self._output_panel.grid(row=6, column=0, sticky="nsew", padx=10, pady=(0, 10))

    def generate_output(self):
        try:
            prefix = self._prefix_text.get("1.0", tk.END).rstrip("\n")
            df = self._grid.get_dataframe()

            if not prefix.strip() and df.empty:
                messagebox.showwarning("경고", "그리드와 접두 문자열이 모두 비어있습니다.")
                return

            sep = self._separator_var.get()
            if not df.empty:
                buf = io.StringIO()
                df.to_csv(buf, header=False, index=False, sep=sep, lineterminator="\n")
                csv_str = buf.getvalue().rstrip("\n")
            else:
                csv_str = ""

            if prefix.strip() and csv_str:
                result = prefix + "\n" + csv_str
            elif prefix.strip():
                result = prefix
            else:
                result = csv_str

            self._last_output = result
            self._output_panel.set_text(result)
        except Exception as e:
            messagebox.showerror("오류", f"출력 생성 중 오류 발생:\n{e}")

    def save_to_file(self):
        if not self._last_output:
            messagebox.showwarning("경고", "먼저 출력을 생성해주세요.")
            return
        path = filedialog.asksaveasfilename(
            filetypes=[("CSV files", "*.csv"), ("Text files", "*.txt"), ("All files", "*.*")],
            defaultextension=".csv"
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self._last_output)
            messagebox.showinfo("저장 완료", f"파일이 저장되었습니다:\n{path}")
        except Exception as e:
            messagebox.showerror("저장 오류", f"파일 저장 실패:\n{e}")

    def copy_to_clipboard(self):
        if not self._last_output:
            messagebox.showwarning("경고", "먼저 출력을 생성해주세요.")
            return
        try:
            self.clipboard_clear()
            self.clipboard_append(self._last_output)
            messagebox.showinfo("복사 완료", "클립보드에 복사되었습니다.")
        except Exception as e:
            messagebox.showerror("오류", f"클립보드 복사 실패:\n{e}")

    def _confirm_clear(self):
        if messagebox.askyesno("초기화 확인", "정말 초기화하시겠습니까?"):
            self._grid.clear()
