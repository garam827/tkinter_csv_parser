"""
app.py
CSV Prefix Tool의 메인 애플리케이션 클래스 모듈.
- 전체 UI 레이아웃 구성 (그리드 / 접두 문자열 입력 / 출력 미리보기)
- 출력 생성(Ctrl+Enter), 파일 저장, 클립보드 복사, CSV 불러오기 기능
- 출력 구분자 선택 (쉼표 / 탭 / 세미콜론)
- 컬럼 필터: 체크박스로 출력에 포함할 열을 선택
- Frutiger Aero 디자인 테마 적용 (theme.py)
"""

import io
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk

import pandas as pd

from grid_widget import CSVGrid
from output_panel import OutputPanel
from theme import (
    apply_ttk_theme, GlossyButton, draw_gradient,
    C_WIN_BG, C_PANEL, C_PANEL_DARK, C_HDR_BG, C_CELL_BD,
    C_BTN2_TOP, C_BTN2_BOT, C_BTN_BD,
    C_TEXT_TITLE, C_TEXT_LABEL, C_LF_TITLE, C_DISABLED,
    C_BORDER, C_CELL_BG,
    FONT_TITLE, FONT_LABEL, FONT_SECTION, FONT_BTN, FONT_SMALL,
)


class CSVPrefixApp(tk.Tk):
    """
    최상위 tkinter 윈도우 클래스.
    Frutiger Aero 테마: 맑은 하늘색 배경, 유리빛 패널, 광택 버튼.
    """

    def __init__(self):
        super().__init__()
        self.title("CSV Prefix Tool")
        self.minsize(720, 750)

        # 가장 최근에 생성된 출력 문자열 (저장/복사에 사용)
        self._last_output = None

        # 출력 CSV 구분자 (기본값: 쉼표)
        self._separator_var = tk.StringVar(value=",")

        # 컬럼 필터 체크박스: {열 인덱스(int): tk.BooleanVar}
        self._col_filter_vars: dict = {}

        # Frutiger Aero ttk 전역 테마 적용 (창 배경색 포함)
        apply_ttk_theme(self)

        self._build_ui()

        # Ctrl+Enter 전역 단축키 → 출력 생성
        self.bind_all("<Control-Return>", lambda e: self.generate_output())

    # ------------------------------------------------------------------ #
    #  창 배경 그라데이션
    # ------------------------------------------------------------------ #

    def _setup_gradient_bg(self):
        """
        창 전체에 하늘색 → 연한 흰색 세로 그라데이션을 그린다.
        Canvas를 가장 뒤에 배치하고, 창 크기가 바뀔 때마다 다시 그린다.
        """
        self._bg_canvas = tk.Canvas(
            self, highlightthickness=0, bd=0
        )
        # Canvas를 place로 창 전체에 배치 (다른 위젯 뒤쪽)
        self._bg_canvas.place(relx=0, rely=0, relwidth=1, relheight=1)
        # Canvas.lower()는 캔버스 아이템 메서드라 충돌하므로
        # Misc.lower()를 직접 호출해 위젯 스택 순서를 조정한다
        tk.Misc.lower(self._bg_canvas)

        def _redraw(event=None):
            w = self.winfo_width()
            h = self.winfo_height()
            if w > 1 and h > 1:
                draw_gradient(
                    self._bg_canvas, w, h,
                    color_top="#A8D8F0",   # 상단: 선명한 하늘색
                    color_bot="#E8F6FF",   # 하단: 거의 흰색 (구름빛)
                    steps=60,
                )

        self.bind("<Configure>", lambda e: _redraw())
        self.after(100, _redraw)  # 초기 그리기 (윈도우가 완전히 렌더된 후)

    # ------------------------------------------------------------------ #
    #  UI 구성
    # ------------------------------------------------------------------ #

    def _build_ui(self):
        """
        전체 레이아웃을 grid 방식으로 구성한다.

        row 할당:
          0 - 타이틀 + 앱 설명
          1 - 출력 구분자 선택
          2 - CSV 그리드 LabelFrame (weight=3)
          3 - 접두 문자열 레이블
          4 - 접두 문자열 입력창 (weight=1)
          5 - 액션 버튼 영역
          6 - 출력 미리보기 (weight=2)
        """
        # 창 배경 그라데이션 설정
        self._setup_gradient_bg()

        # ── 행 신축성 설정 ──
        self.rowconfigure(2, weight=3)   # 그리드: 가장 크게 늘어남
        self.rowconfigure(4, weight=1)   # 접두 문자열: 조금 늘어남
        self.rowconfigure(6, weight=2)   # 출력 미리보기: 중간 정도
        self.columnconfigure(0, weight=1)

        # ── 타이틀 영역 ──
        title_frame = tk.Frame(self, bg=C_WIN_BG)
        title_frame.grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 6))

        tk.Label(
            title_frame,
            text="CSV Prefix Tool",
            font=FONT_TITLE,
            bg=C_WIN_BG,
            fg=C_TEXT_TITLE,
        ).pack(side=tk.LEFT)

        tk.Label(
            title_frame,
            text="  —  CSV 데이터에 접두 문자열을 붙여 출력합니다",
            font=FONT_SMALL,
            bg=C_WIN_BG,
            fg=C_TEXT_LABEL,
        ).pack(side=tk.LEFT, pady=(4, 0))

        # ── 구분자 선택 패널 ──
        sep_lf = ttk.LabelFrame(self, text="출력 구분자")
        sep_lf.grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 6))

        # LabelFrame 내부 배경을 C_PANEL로 맞추기 위한 Frame
        sep_inner = tk.Frame(sep_lf, bg=C_PANEL)
        sep_inner.pack(fill=tk.X, padx=6, pady=4)

        for text, val in [("쉼표  ( , )", ","), ("탭  ( \\t )", "\t"), ("세미콜론  ( ; )", ";")]:
            tk.Radiobutton(
                sep_inner,
                text=text,
                variable=self._separator_var,
                value=val,
                font=FONT_LABEL,
                bg=C_PANEL,
                fg=C_TEXT_LABEL,
                activebackground=C_PANEL,
                activeforeground=C_HDR_BG,
                selectcolor=C_PANEL,       # 선택 원 배경색
            ).pack(side=tk.LEFT, padx=10)

        # ── CSV 그리드 영역 ──
        grid_lf = ttk.LabelFrame(self, text="CSV 데이터 입력")
        grid_lf.grid(row=2, column=0, sticky="nsew", padx=14, pady=4)
        grid_lf.rowconfigure(0, weight=1)
        grid_lf.columnconfigure(0, weight=1)

        # on_structure_change → 열이 바뀔 때 컬럼 필터 패널 자동 갱신
        self._grid = CSVGrid(
            grid_lf, on_structure_change=self._refresh_col_filter
        )
        self._grid.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)

        # ── 그리드 컨트롤 버튼 행 ──
        ctrl_frame = tk.Frame(grid_lf, bg=C_PANEL)
        ctrl_frame.grid(row=1, column=0, sticky="ew", padx=6, pady=(0, 4))

        # 보조 버튼 (행/열 조작): 작고 연한 파랑
        _ctrl_btn_cfg = dict(
            width=68, height=26,
            top_color=C_BTN2_TOP, bot_color=C_BTN2_BOT,
            font=("Segoe UI", 9, "bold"),
            bg=C_PANEL,
        )
        for label, cmd in [
            ("행 추가", self._grid.add_row),
            ("행 삭제", self._grid.delete_row),
            ("열 추가", self._grid.add_col),
            ("열 삭제", self._grid.delete_col),
        ]:
            GlossyButton(ctrl_frame, text=label, command=cmd, **_ctrl_btn_cfg).pack(
                side=tk.LEFT, padx=3, pady=3
            )

        # 구분 선
        tk.Frame(ctrl_frame, width=1, height=20, bg=C_BORDER).pack(
            side=tk.LEFT, padx=6, pady=3
        )

        for label, cmd in [
            ("CSV 불러오기", self.load_csv_file),
            ("그리드 초기화", self._confirm_clear),
        ]:
            GlossyButton(ctrl_frame, text=label, command=cmd, **_ctrl_btn_cfg).pack(
                side=tk.LEFT, padx=3, pady=3
            )

        # ── 컬럼 필터 패널 ──
        col_filter_lf = ttk.LabelFrame(grid_lf, text="컬럼 필터  (출력에 포함할 열 선택)")
        col_filter_lf.grid(row=2, column=0, sticky="ew", padx=6, pady=(0, 6))

        cf_inner = tk.Frame(col_filter_lf, bg=C_PANEL)
        cf_inner.pack(fill=tk.X, padx=4, pady=4)

        # 전체 선택 / 전체 해제 버튼 (작은 보조 버튼)
        _filter_btn_cfg = dict(
            width=72, height=22,
            top_color=C_BTN2_TOP, bot_color=C_BTN2_BOT,
            font=("Segoe UI", 8, "bold"),
            bg=C_PANEL,
        )
        GlossyButton(cf_inner, text="전체 선택", command=self._select_all_cols,
                     **_filter_btn_cfg).pack(side=tk.LEFT, padx=3)
        GlossyButton(cf_inner, text="전체 해제", command=self._deselect_all_cols,
                     **_filter_btn_cfg).pack(side=tk.LEFT, padx=3)

        # 구분 선
        tk.Frame(cf_inner, width=1, height=16, bg=C_BORDER).pack(
            side=tk.LEFT, padx=8, pady=2
        )

        # 체크박스 영역 (열이 많으면 수평 스크롤)
        cb_canvas = tk.Canvas(
            cf_inner, height=26, bg=C_PANEL,
            highlightthickness=0,
        )
        cb_hscroll = tk.Scrollbar(
            cf_inner, orient=tk.HORIZONTAL,
            command=cb_canvas.xview,
            bg=C_HDR_BG, troughcolor=C_PANEL, relief=tk.FLAT,
        )
        cb_canvas.configure(xscrollcommand=cb_hscroll.set)

        # 체크박스가 실제로 들어갈 내부 Frame
        self._col_filter_inner = tk.Frame(cb_canvas, bg=C_PANEL)
        cb_canvas.create_window((0, 0), window=self._col_filter_inner, anchor="nw")
        self._col_filter_inner.bind(
            "<Configure>",
            lambda e: cb_canvas.configure(
                scrollregion=cb_canvas.bbox("all")
            ),
        )

        cb_canvas.pack(side=tk.LEFT, fill=tk.X, expand=True)
        cb_hscroll.pack(side=tk.BOTTOM, fill=tk.X)

        # ── 접두 문자열 입력 ──
        tk.Label(
            self,
            text="Prefix Text  (접두 문자열)",
            font=FONT_SECTION,
            bg=C_WIN_BG,
            fg=C_LF_TITLE,
            anchor="w",
        ).grid(row=3, column=0, sticky="w", padx=14, pady=(8, 2))

        prefix_frame = tk.Frame(self, bg=C_WIN_BG)
        prefix_frame.grid(row=4, column=0, sticky="nsew", padx=14, pady=(0, 6))
        prefix_frame.rowconfigure(0, weight=1)
        prefix_frame.columnconfigure(0, weight=1)

        prefix_vscroll = tk.Scrollbar(
            prefix_frame, orient=tk.VERTICAL,
            bg=C_HDR_BG, troughcolor=C_PANEL,
            activebackground=C_WIN_BG, relief=tk.FLAT,
        )
        self._prefix_text = tk.Text(
            prefix_frame,
            height=5,
            font=FONT_LABEL,
            bg=C_CELL_BG,              # 유리빛 흰색
            fg="#1A2030",
            insertbackground=C_HDR_BG, # 커서: 하늘 파랑
            relief=tk.SOLID,
            borderwidth=1,
            highlightthickness=1,
            highlightbackground=C_CELL_BD,
            highlightcolor=C_HDR_BG,
            selectbackground=C_HDR_BG,
            selectforeground="#FFFFFF",
            yscrollcommand=prefix_vscroll.set,
        )
        prefix_vscroll.config(command=self._prefix_text.yview)
        self._prefix_text.grid(row=0, column=0, sticky="nsew")
        prefix_vscroll.grid(row=0, column=1, sticky="ns")

        # ── 액션 버튼 행 ──
        btn_frame = tk.Frame(self, bg=C_WIN_BG)
        btn_frame.grid(row=5, column=0, sticky="w", padx=14, pady=8)

        # 주 버튼: 출력 생성 (가장 크고 선명한 파랑)
        GlossyButton(
            btn_frame,
            text="출력 생성  (Ctrl+Enter)",
            command=self.generate_output,
            width=190, height=36,
            bg=C_WIN_BG,
        ).pack(side=tk.LEFT, padx=(0, 8))

        # 보조 버튼: 파일 저장 / 클립보드 복사
        for label, cmd in [
            ("파일 저장", self.save_to_file),
            ("클립보드 복사", self.copy_to_clipboard),
        ]:
            GlossyButton(
                btn_frame,
                text=label,
                command=cmd,
                width=130, height=36,
                top_color=C_BTN2_TOP,
                bot_color=C_BTN2_BOT,
                bg=C_WIN_BG,
            ).pack(side=tk.LEFT, padx=4)

        # ── 출력 미리보기 ──
        self._output_panel = OutputPanel(self)
        self._output_panel.grid(row=6, column=0, sticky="nsew", padx=14, pady=(0, 14))

    # ------------------------------------------------------------------ #
    #  핵심 기능
    # ------------------------------------------------------------------ #

    def generate_output(self):
        """
        접두 문자열 + CSV 데이터를 합쳐 출력을 생성한다.

        규칙:
          - 선택된 열이 하나도 없으면 경고.
          - 둘 다 비어있으면 경고.
          - 접두만 있으면 접두만 출력.
          - CSV만 있으면 CSV만 출력.
          - 둘 다 있으면 '접두\\nCSV' 형식으로 합침.

        결과는 출력 미리보기에 표시되고 self._last_output에 저장된다.
        """
        try:
            # 접두 문자열 읽기 (맨 끝 빈 줄 제거)
            prefix = self._prefix_text.get("1.0", tk.END).rstrip("\n")

            # 컬럼 필터에서 선택된 열 인덱스 수집
            selected_cols = [
                i for i, var in self._col_filter_vars.items() if var.get()
            ]
            if not selected_cols:
                messagebox.showwarning("경고", "출력할 열을 하나 이상 선택해주세요.")
                return

            # 선택된 열만 포함한 DataFrame 가져오기 (빈 행 제외)
            df = self._grid.get_dataframe(col_indices=selected_cols)

            # 둘 다 비어있는 경우
            if not prefix.strip() and df.empty:
                messagebox.showwarning("경고", "그리드와 접두 문자열이 모두 비어있습니다.")
                return

            # DataFrame → CSV 문자열 직렬화
            sep = self._separator_var.get()
            if not df.empty:
                buf = io.StringIO()
                df.to_csv(
                    buf,
                    header=False,        # 컬럼 헤더 제외
                    index=False,         # 인덱스 번호 제외
                    sep=sep,
                    lineterminator="\n",
                )
                csv_str = buf.getvalue().rstrip("\n")
            else:
                csv_str = ""

            # 최종 출력 조합
            if prefix.strip() and csv_str:
                result = prefix + "\n" + csv_str
            elif prefix.strip():
                result = prefix
            else:
                result = csv_str

            # 저장 및 미리보기 갱신
            self._last_output = result
            self._output_panel.set_text(result)

        except Exception as e:
            messagebox.showerror("오류", f"출력 생성 중 오류 발생:\n{e}")

    def load_csv_file(self):
        """
        CSV 파일을 파일 다이얼로그로 선택해 그리드에 로드한다.
        header=None: 첫 행도 데이터로 처리.
        dtype=str: 모든 값을 문자열로 읽어 숫자 포맷 변환을 방지한다.
        """
        path = filedialog.askopenfilename(
            title="CSV 파일 열기",
            filetypes=[
                ("CSV files", "*.csv"),
                ("Text files", "*.txt"),
                ("All files", "*.*"),
            ],
        )
        if not path:
            return  # 다이얼로그 취소 → 아무것도 하지 않음

        try:
            df = pd.read_csv(path, header=None, dtype=str).fillna("")
            self._grid.load_dataframe(df)
        except Exception as e:
            messagebox.showerror("불러오기 오류", f"파일을 읽는 중 오류 발생:\n{e}")

    def save_to_file(self):
        """
        self._last_output을 파일로 저장한다.
        출력이 없으면 경고. UTF-8로 인코딩.
        """
        if not self._last_output:
            messagebox.showwarning("경고", "먼저 출력을 생성해주세요.")
            return

        path = filedialog.asksaveasfilename(
            title="파일 저장",
            filetypes=[
                ("CSV files", "*.csv"),
                ("Text files", "*.txt"),
                ("All files", "*.*"),
            ],
            defaultextension=".csv",
        )
        if not path:
            return  # 취소 → 아무것도 하지 않음

        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self._last_output)
            messagebox.showinfo("저장 완료", f"파일이 저장되었습니다:\n{path}")
        except Exception as e:
            messagebox.showerror("저장 오류", f"파일 저장 실패:\n{e}")

    def copy_to_clipboard(self):
        """self._last_output을 클립보드에 복사한다."""
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
        """그리드 초기화 전 확인 다이얼로그를 표시한다."""
        if messagebox.askyesno("초기화 확인", "그리드의 모든 데이터를 초기화하시겠습니까?"):
            self._grid.clear()

    # ------------------------------------------------------------------ #
    #  컬럼 필터 관련
    # ------------------------------------------------------------------ #

    def _refresh_col_filter(self):
        """
        그리드의 열 구조가 변경될 때 호출된다 (CSVGrid의 on_structure_change 콜백).
        현재 열 수에 맞게 체크박스를 다시 그린다.

        - 기존 열의 선택 상태(True/False)는 유지한다.
        - 새로 추가된 열은 기본값 True(선택)으로 시작한다.
        - 삭제된 열의 BooleanVar는 dict에서 제거한다.
        """
        col_count = self._grid.get_col_count()
        col_labels = self._grid.get_col_labels()   # ['A', 'B', 'C', ...]

        # 기존 체크박스 위젯 제거 (BooleanVar는 유지해 선택 상태 보존)
        for widget in self._col_filter_inner.winfo_children():
            widget.destroy()

        # 범위를 벗어난 열의 BooleanVar 정리
        for i in [k for k in self._col_filter_vars if k >= col_count]:
            del self._col_filter_vars[i]

        # 열마다 체크박스 생성
        for i, label in enumerate(col_labels):
            # 처음 등장하는 열은 선택(True) 상태로 초기화
            if i not in self._col_filter_vars:
                self._col_filter_vars[i] = tk.BooleanVar(value=True)

            var = self._col_filter_vars[i]

            # 체크박스 (Frutiger Aero 팔레트)
            cb = tk.Checkbutton(
                self._col_filter_inner,
                text=label,
                variable=var,
                font=("Segoe UI", 9, "bold"),
                bg=C_PANEL,
                fg=C_TEXT_LABEL if var.get() else C_DISABLED,
                activebackground=C_PANEL,
                activeforeground=C_HDR_BG,
                selectcolor=C_PANEL,     # 체크박스 내부 배경
                command=lambda idx=i: self._on_col_filter_toggle(idx),
            )
            cb.pack(side=tk.LEFT, padx=4)

    def _on_col_filter_toggle(self, col_idx: int):
        """
        체크박스 클릭 시 호출된다.
        선택 해제된 열은 글자색을 C_DISABLED(회색)로 바꿔 제외 상태를 표시한다.
        """
        var = self._col_filter_vars.get(col_idx)
        if var is None:
            return

        children = self._col_filter_inner.winfo_children()
        if col_idx < len(children):
            # 선택: 파랑 텍스트 / 해제: 회색 텍스트
            children[col_idx].config(
                fg=C_TEXT_LABEL if var.get() else C_DISABLED
            )

    def _select_all_cols(self):
        """모든 열 체크박스를 선택(True) 상태로 설정한다."""
        for i, var in self._col_filter_vars.items():
            var.set(True)
            children = self._col_filter_inner.winfo_children()
            if i < len(children):
                children[i].config(fg=C_TEXT_LABEL)

    def _deselect_all_cols(self):
        """모든 열 체크박스를 해제(False) 상태로 설정한다."""
        for i, var in self._col_filter_vars.items():
            var.set(False)
            children = self._col_filter_inner.winfo_children()
            if i < len(children):
                children[i].config(fg=C_DISABLED)
