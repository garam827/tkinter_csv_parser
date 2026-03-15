"""
grid_widget.py
CSV 데이터를 입력받는 스크롤 가능한 그리드 위젯 모듈.
- 행/열 번호 헤더 표시 (행: 1, 2, 3... / 열: A, B, C...)
- Ctrl+V 붙여넣기 시 구분자 자동 감지 및 그리드 자동 확장
- Tab/Enter/방향키로 셀 간 이동
- 마우스 휠 세로 스크롤 지원
- 행/열 추가·삭제 시 데이터 보존 및 삭제 전 경고
- on_structure_change 콜백: 열 수가 바뀔 때 외부(app.py)에 알림
- get_dataframe(col_indices): 선택된 열만 DataFrame으로 반환
- Frutiger Aero 디자인 테마 적용 (theme.py)
"""

import csv
import io
import tkinter as tk
from tkinter import messagebox
import pandas as pd

# Frutiger Aero 색상/폰트 상수 임포트
from theme import (
    C_WIN_BG, C_PANEL, C_CELL_BG, C_CELL_FOCUS, C_CELL_BD,
    C_HDR_BG, C_HDR_TEXT, FONT_CELL, FONT_HDR,
)


class CSVGrid(tk.Frame):
    """
    스크롤 가능한 CSV 입력 그리드 위젯.
    tkinter.Frame을 상속하며, 내부적으로 Canvas + 내부 Frame 구조로
    수평·수직 스크롤을 지원한다.
    Frutiger Aero 테마: 하늘색 헤더, 유리빛 셀 배경.
    """

    # 기본 행/열 수
    DEFAULT_ROWS = 10
    DEFAULT_COLS = 6

    def __init__(self, master, on_structure_change=None, **kwargs):
        """
        Parameters
        ----------
        on_structure_change : callable | None
            열 수가 변경될 때마다 호출되는 콜백 함수.
            app.py가 컬럼 필터 패널을 갱신하는 데 사용한다.
        """
        # 위젯 배경을 창 배경색과 통일해 경계선이 보이지 않도록 함
        kwargs.setdefault("bg", C_WIN_BG)
        super().__init__(master, **kwargs)

        # 현재 그리드 크기
        self._rows = self.DEFAULT_ROWS
        self._cols = self.DEFAULT_COLS

        # (행, 열) → Entry 위젯 딕셔너리
        self._cells = {}

        # 현재 포커스된 셀 좌표 (붙여넣기 시작 위치에 사용)
        self._focused = (0, 0)

        # 열 구조가 바뀔 때 외부로 알리는 콜백 (None이면 사용 안 함)
        self._on_structure_change = on_structure_change

        # 스크롤 컨테이너(Canvas) 생성 후 그리드 빌드
        self._build_scroll_container()
        self._build_grid()

    # ------------------------------------------------------------------ #
    #  스크롤 컨테이너 구성
    # ------------------------------------------------------------------ #

    def _build_scroll_container(self):
        """
        Canvas + 수직/수평 스크롤바를 배치한다.
        그리드가 창 크기를 초과할 때 스크롤로 탐색할 수 있다.
        스크롤바도 Frutiger Aero 팔레트 색상을 사용한다.
        """
        # 수직 스크롤바 (오른쪽)
        self._vscroll = tk.Scrollbar(
            self, orient=tk.VERTICAL,
            bg=C_HDR_BG, troughcolor=C_PANEL,
            activebackground=C_WIN_BG, relief=tk.FLAT,
        )
        self._vscroll.pack(side=tk.RIGHT, fill=tk.Y)

        # 수평 스크롤바 (아래쪽)
        self._hscroll = tk.Scrollbar(
            self, orient=tk.HORIZONTAL,
            bg=C_HDR_BG, troughcolor=C_PANEL,
            activebackground=C_WIN_BG, relief=tk.FLAT,
        )
        self._hscroll.pack(side=tk.BOTTOM, fill=tk.X)

        # 스크롤 가능한 캔버스 (그리드 컨테이너)
        self._canvas = tk.Canvas(
            self,
            yscrollcommand=self._vscroll.set,
            xscrollcommand=self._hscroll.set,
            borderwidth=0,
            highlightthickness=0,
            bg=C_WIN_BG,   # 캔버스 배경도 하늘색으로 통일
        )
        self._canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 스크롤바와 캔버스 연결
        self._vscroll.config(command=self._canvas.yview)
        self._hscroll.config(command=self._canvas.xview)

        # 캔버스 내부 실제 그리드를 담을 Frame
        self._inner = tk.Frame(self._canvas, bg=C_WIN_BG)

        # 캔버스에 내부 Frame을 윈도우로 삽입 (좌상단 기준)
        self._canvas_win = self._canvas.create_window(
            (0, 0), window=self._inner, anchor="nw"
        )

        # 내부 Frame 크기가 바뀔 때마다 스크롤 영역을 업데이트
        self._inner.bind("<Configure>", self._on_inner_configure)

        # 캔버스 자체 크기가 바뀔 때 내부 Frame 너비를 맞춤
        self._canvas.bind("<Configure>", self._on_canvas_configure)

        # 마우스 휠 → 캔버스 세로 스크롤
        self._canvas.bind("<MouseWheel>", self._on_mousewheel)
        self._inner.bind("<MouseWheel>", self._on_mousewheel)

    def _on_inner_configure(self, event):
        """내부 Frame 크기 변경 시 캔버스 스크롤 영역을 전체 내용에 맞게 갱신."""
        self._canvas.configure(scrollregion=self._canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        """
        캔버스(창) 너비가 바뀔 때 내부 Frame 너비를 캔버스에 맞춘다.
        그리드가 캔버스보다 작으면 좌우 여백 없이 꽉 채운다.
        """
        canvas_w = event.width
        inner_w = self._inner.winfo_reqwidth()
        if inner_w < canvas_w:
            self._canvas.itemconfig(self._canvas_win, width=canvas_w)

    def _on_mousewheel(self, event):
        """마우스 휠 이벤트 → 캔버스 세로 스크롤 (Windows: delta=±120)."""
        self._canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    # ------------------------------------------------------------------ #
    #  그리드 생성
    # ------------------------------------------------------------------ #

    def _build_grid(self):
        """
        내부 Frame 안에 열 헤더(A, B, C...) + 행 번호(1, 2, 3...) +
        Entry 셀을 생성한다. 호출 전에 기존 위젯을 모두 삭제한다.

        Frutiger Aero 스타일:
          - 헤더: C_HDR_BG(하늘색) 배경 + 흰색 굵은 텍스트
          - 셀: C_CELL_BG(유리빛 흰색) 배경 + C_CELL_BD(연한 파랑) 테두리
          - 포커스 셀: C_CELL_FOCUS(순백) 배경으로 전환
        """
        # 기존 위젯 제거 (재빌드 시 초기화)
        for widget in self._inner.winfo_children():
            widget.destroy()
        self._cells = {}

        # ── 열 헤더 (0행): 빈 코너 + A, B, C, ... ──
        tk.Label(
            self._inner,
            text="",
            width=4,
            bg=C_HDR_BG,       # 헤더 배경: 하늘 파랑
            fg=C_HDR_TEXT,
            font=FONT_HDR,
            relief=tk.FLAT,
            bd=1,
        ).grid(row=0, column=0, padx=1, pady=1, sticky="nsew")

        for c in range(self._cols):
            tk.Label(
                self._inner,
                text=self._col_label(c),   # 0→A, 1→B, ...
                width=12,
                bg=C_HDR_BG,
                fg=C_HDR_TEXT,
                font=FONT_HDR,
                relief=tk.FLAT,
                bd=1,
            ).grid(row=0, column=c + 1, padx=1, pady=1, sticky="nsew")

        # ── 행 번호 + 데이터 셀 (1행~) ──
        for r in range(self._rows):
            # 행 번호 레이블 (1부터 시작)
            tk.Label(
                self._inner,
                text=str(r + 1),
                width=4,
                bg=C_HDR_BG,
                fg=C_HDR_TEXT,
                font=FONT_HDR,
                relief=tk.FLAT,
                bd=1,
            ).grid(row=r + 1, column=0, padx=1, pady=1, sticky="nsew")

            for c in range(self._cols):
                entry = tk.Entry(
                    self._inner,
                    width=12,
                    font=FONT_CELL,
                    relief=tk.SOLID,
                    borderwidth=1,
                    bg=C_CELL_BG,            # 셀 기본 배경: 유리빛 흰색
                    fg="#1A2030",            # 셀 텍스트: 거의 검정
                    insertbackground="#0D5A96",  # 커서 색: 미드 블루
                    highlightthickness=1,
                    highlightbackground=C_CELL_BD,   # 테두리: 연한 파랑
                    highlightcolor=C_HDR_BG,         # 포커스 테두리: 하늘 파랑
                )
                entry.grid(row=r + 1, column=c + 1, padx=1, pady=1, sticky="nsew")

                # 포커스 진입: 셀 위치 기록 + 배경 흰색으로 전환
                entry.bind("<FocusIn>",
                    lambda e, row=r, col=c, ent=entry: self._on_focus(row, col, ent))
                # 포커스 이탈: 배경 복원
                entry.bind("<FocusOut>",
                    lambda e, ent=entry: ent.config(bg=C_CELL_BG))

                # 붙여넣기 (대소문자 모두 처리)
                entry.bind("<Control-v>", self._on_paste)
                entry.bind("<Control-V>", self._on_paste)

                # ── 셀 이동 단축키 ──
                entry.bind("<Tab>",
                    lambda e, row=r, col=c: self._move_focus(row, col, 0, 1))
                entry.bind("<Shift-Tab>",
                    lambda e, row=r, col=c: self._move_focus(row, col, 0, -1))
                entry.bind("<Return>",
                    lambda e, row=r, col=c: self._move_focus(row, col, 1, 0))
                entry.bind("<Down>",
                    lambda e, row=r, col=c: self._move_focus(row, col, 1, 0))
                entry.bind("<Up>",
                    lambda e, row=r, col=c: self._move_focus(row, col, -1, 0))

                # 셀에서도 마우스 휠 스크롤 동작
                entry.bind("<MouseWheel>", self._on_mousewheel)

                self._cells[(r, c)] = entry

        # 열 너비 균등 배분 (헤더 열 포함)
        for c in range(self._cols + 1):
            self._inner.columnconfigure(c, weight=1)

        # 그리드 구조(열 수)가 바뀌었음을 외부에 알린다.
        # after(0, ...): 현재 이벤트 루프가 끝난 뒤 호출해 초기화 순서 문제 방지
        if self._on_structure_change:
            self.after(0, self._on_structure_change)

    # ------------------------------------------------------------------ #
    #  열 이름 변환 유틸
    # ------------------------------------------------------------------ #

    @staticmethod
    def _col_label(col_index: int) -> str:
        """
        열 인덱스를 엑셀 스타일 문자 이름으로 변환한다.
        예: 0→'A', 25→'Z', 26→'AA', 27→'AB'
        """
        label = ""
        n = col_index + 1  # 1-based 변환
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            label = chr(65 + remainder) + label
        return label

    # ------------------------------------------------------------------ #
    #  포커스 관련
    # ------------------------------------------------------------------ #

    def _on_focus(self, row: int, col: int, entry: tk.Entry):
        """
        셀에 포커스가 들어올 때:
          1. 현재 위치 기록 (붙여넣기 기준점)
          2. 셀 배경을 순백(C_CELL_FOCUS)으로 변경해 활성 셀을 시각적으로 강조
        """
        self._focused = (row, col)
        entry.config(bg=C_CELL_FOCUS)

    def _move_focus(self, row: int, col: int, dr: int, dc: int):
        """
        (row, col) 기준으로 (dr, dc) 방향의 인접 셀로 포커스를 이동한다.
        - Tab(dc=+1): 열 끝이면 다음 행 첫 열로 이동
        - Shift+Tab(dc=-1): 열 시작이면 이전 행 마지막 열로 이동
        - 범위를 벗어나면 이동하지 않는다.
        """
        new_r, new_c = row + dr, col + dc

        # Tab으로 열 끝을 넘어갈 경우 → 다음 행 첫 열
        if new_c >= self._cols:
            new_c = 0
            new_r += 1
        # Shift+Tab으로 열 시작 이전 → 이전 행 마지막 열
        elif new_c < 0:
            new_c = self._cols - 1
            new_r -= 1

        # 유효 범위 내에서만 이동
        if 0 <= new_r < self._rows and 0 <= new_c < self._cols:
            target = self._cells.get((new_r, new_c))
            if target:
                target.focus_set()

        return "break"  # 기본 Tab 동작(위젯 순환)을 막는다

    # ------------------------------------------------------------------ #
    #  붙여넣기
    # ------------------------------------------------------------------ #

    def _on_paste(self, event):
        """
        Ctrl+V 이벤트 핸들러.
        클립보드 텍스트를 파싱해 현재 포커스된 셀부터 채운다.
        데이터가 그리드를 초과하면 자동으로 확장한다.
        """
        try:
            clipboard = self.winfo_toplevel().clipboard_get()
        except tk.TclError:
            messagebox.showerror("붙여넣기 오류", "클립보드가 비어있습니다.")
            return "break"

        if not clipboard.strip():
            messagebox.showerror("붙여넣기 오류", "클립보드가 비어있습니다.")
            return "break"

        # 클립보드 텍스트를 2D 리스트로 파싱
        rows = self._parse_clipboard(clipboard)
        if rows is None:
            return "break"

        start_r, start_c = self._focused

        # 붙여넣기 후 필요한 최소 행/열 수 계산
        need_r = start_r + len(rows)
        need_c = start_c + max(len(row) for row in rows)

        # 현재 그리드가 부족하면 확장 (포커스 위치 기억)
        if need_r > self._rows or need_c > self._cols:
            self._expand(
                max(need_r, self._rows),
                max(need_c, self._cols),
                restore_focus=self._focused,
            )

        # 파싱된 데이터를 셀에 입력
        for dr, row_data in enumerate(rows):
            for dc, val in enumerate(row_data):
                cell = self._cells.get((start_r + dr, start_c + dc))
                if cell:
                    cell.delete(0, tk.END)
                    cell.insert(0, val)

        return "break"  # 기본 붙여넣기 동작 차단

    def _parse_clipboard(self, text: str):
        """
        클립보드 텍스트를 2D 리스트로 파싱한다.
        구분자 우선순위: 탭(\\t) → 쉼표(,) → 세미콜론(;)
        모두 실패하면 줄 단위 단일 열로 반환한다.
        """
        for delimiter in ["\t", ",", ";"]:
            try:
                reader = csv.reader(io.StringIO(text), delimiter=delimiter)
                parsed = list(reader)
                if parsed and (len(parsed) > 1 or len(parsed[0]) > 1):
                    return parsed
            except Exception:
                continue

        # 구분자 감지 실패 → 줄 단위로 단일 열 처리
        lines = text.splitlines()
        if lines:
            return [[line] for line in lines]

        messagebox.showerror("붙여넣기 오류", "클립보드 데이터를 파싱할 수 없습니다.")
        return None

    # ------------------------------------------------------------------ #
    #  데이터 저장 / 복원 / 확장 (내부 공통 로직)
    # ------------------------------------------------------------------ #

    def _save_data(self) -> dict:
        """현재 모든 셀의 값을 {(row, col): value} 딕셔너리로 반환한다."""
        return {pos: entry.get() for pos, entry in self._cells.items()}

    def _restore_data(self, old_data: dict):
        """
        _save_data()로 저장한 딕셔너리를 현재 그리드에 복원한다.
        현재 그리드 범위를 벗어난 셀은 무시한다.
        """
        for (r, c), val in old_data.items():
            if val and r < self._rows and c < self._cols:
                cell = self._cells.get((r, c))
                if cell:
                    cell.insert(0, val)

    def _expand(self, new_rows: int, new_cols: int, restore_focus=None):
        """
        그리드를 new_rows × new_cols 크기로 확장한다.
        기존 데이터는 보존되고, restore_focus 위치가 지정되면
        확장 후 해당 셀로 포커스를 복원한다.
        """
        old_data = self._save_data()      # 기존 데이터 백업
        self._rows = new_rows
        self._cols = new_cols
        self._build_grid()                # 그리드 전체 재빌드
        self._restore_data(old_data)      # 데이터 복원

        # 포커스 복원
        if restore_focus:
            cell = self._cells.get(restore_focus)
            if cell:
                cell.focus_set()

    # ------------------------------------------------------------------ #
    #  마지막 행/열 데이터 확인 (삭제 전 경고용)
    # ------------------------------------------------------------------ #

    def _has_data_in_last_row(self) -> bool:
        """마지막 행(self._rows - 1)에 내용이 있는지 확인한다."""
        r = self._rows - 1
        return any(self._cells[(r, c)].get().strip() for c in range(self._cols))

    def _has_data_in_last_col(self) -> bool:
        """마지막 열(self._cols - 1)에 내용이 있는지 확인한다."""
        c = self._cols - 1
        return any(self._cells[(r, c)].get().strip() for r in range(self._rows))

    # ------------------------------------------------------------------ #
    #  공개 API
    # ------------------------------------------------------------------ #

    def get_col_count(self) -> int:
        """현재 그리드의 열 수를 반환한다. 컬럼 필터 패널 갱신에 사용."""
        return self._cols

    def get_col_labels(self) -> list:
        """
        현재 열 수만큼의 열 이름 리스트를 반환한다.
        예: 열이 3개면 ['A', 'B', 'C'] 반환.
        """
        return [self._col_label(c) for c in range(self._cols)]

    def get_dataframe(self, col_indices=None) -> "pd.DataFrame":
        """
        현재 그리드 내용을 pandas DataFrame으로 반환한다.
        완전히 비어있는 행은 제외한다.

        Parameters
        ----------
        col_indices : list[int] | None
            출력에 포함할 열 인덱스 리스트.
            None이면 전체 열을 포함한다.
            빈 리스트([])이면 빈 DataFrame을 반환한다.
        """
        selected = col_indices if col_indices is not None else list(range(self._cols))

        if not selected:
            return pd.DataFrame()

        data = []
        for r in range(self._rows):
            row = [self._cells[(r, c)].get() for c in selected]
            if any(v.strip() for v in row):
                data.append(row)

        if not data:
            return pd.DataFrame()
        return pd.DataFrame(data)

    def clear(self):
        """모든 셀의 내용을 지운다."""
        for entry in self._cells.values():
            entry.delete(0, tk.END)

    def add_row(self):
        """그리드 아래에 빈 행 1개를 추가한다."""
        self._expand(self._rows + 1, self._cols)

    def delete_row(self):
        """
        마지막 행을 삭제한다.
        최소 1행 유지. 데이터가 있으면 삭제 전 확인 다이얼로그를 표시한다.
        """
        if self._rows <= 1:
            return
        if self._has_data_in_last_row():
            if not messagebox.askyesno(
                "행 삭제 확인",
                f"{self._rows}행에 데이터가 있습니다. 정말 삭제하시겠습니까?",
            ):
                return

        old_data = self._save_data()
        self._rows -= 1
        self._build_grid()
        self._restore_data(old_data)

    def add_col(self):
        """그리드 오른쪽에 빈 열 1개를 추가한다."""
        self._expand(self._rows, self._cols + 1)

    def delete_col(self):
        """
        마지막 열을 삭제한다.
        최소 1열 유지. 데이터가 있으면 삭제 전 확인 다이얼로그를 표시한다.
        """
        if self._cols <= 1:
            return
        if self._has_data_in_last_col():
            col_letter = self._col_label(self._cols - 1)
            if not messagebox.askyesno(
                "열 삭제 확인",
                f"'{col_letter}'열에 데이터가 있습니다. 정말 삭제하시겠습니까?",
            ):
                return

        old_data = self._save_data()
        self._cols -= 1
        self._build_grid()
        self._restore_data(old_data)

    def load_dataframe(self, df: "pd.DataFrame"):
        """
        외부 DataFrame을 그리드에 로드한다.
        DataFrame 크기가 현재 그리드를 초과하면 자동으로 확장한다.
        기존 데이터는 먼저 초기화된다.
        """
        rows, cols = df.shape

        if rows > self._rows or cols > self._cols:
            self._rows = max(rows, self._rows)
            self._cols = max(cols, self._cols)
            self._build_grid()
        else:
            self.clear()

        # DataFrame 내용을 셀에 입력
        for r in range(rows):
            for c in range(cols):
                cell = self._cells.get((r, c))
                if cell:
                    cell.delete(0, tk.END)
                    cell.insert(0, str(df.iloc[r, c]))
