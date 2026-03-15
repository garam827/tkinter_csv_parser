"""
theme.py
Frutiger Aero 디자인 테마 모듈.

Frutiger Aero란?
  2004~2013년 Microsoft / 소프트웨어 업계를 중심으로 유행한 디자인 언어.
  맑은 하늘색, 유리처럼 투명한 패널, 광택 버튼, 자연 모티프(구름·물·빛)가 특징.

이 모듈이 제공하는 것:
  - C_*  : 색상 상수 (팔레트)
  - FONT_*: 폰트 상수 (Segoe UI 계열)
  - apply_ttk_theme(): ttk.Style 전역 설정
  - GlossyButton: Canvas 기반 광택 버튼 위젯
  - draw_gradient(): Canvas에 세로 그라데이션을 그리는 유틸 함수
"""

import tkinter as tk
from tkinter import ttk


# ══════════════════════════════════════════════════════════════════════════ #
#  색상 팔레트
# ══════════════════════════════════════════════════════════════════════════ #

# ── 배경 ──
C_WIN_BG     = "#C2E4F5"   # 창/프레임 기본 배경: 맑은 하늘색
C_PANEL      = "#E4F4FC"   # 카드·패널 배경: 연한 유리색 (frosted glass)
C_PANEL_DARK = "#B8D9ED"   # 서브 패널·선택된 항목 배경

# ── 그리드 ──
C_CELL_BG    = "#F3FBFF"   # 셀 배경: 아주 연한 하늘 (거의 흰색)
C_CELL_FOCUS = "#FFFFFF"   # 포커스된 셀 배경: 순백
C_CELL_BD    = "#90CAF9"   # 셀 테두리: 연한 파랑
C_HDR_BG     = "#3BA0D8"   # 열·행 헤더 배경: 선명한 하늘 파랑
C_HDR_TEXT   = "#FFFFFF"   # 헤더 텍스트: 흰색

# ── 버튼 (광택 그라데이션용 상단/하단 색) ──
C_BTN_TOP    = "#72CBF3"   # 주 버튼 상단 하이라이트 (밝은 하늘)
C_BTN_BOT    = "#1278BE"   # 주 버튼 하단 (깊은 파랑)
C_BTN_HOVER_TOP = "#90D8FA"
C_BTN_HOVER_BOT = "#1A90D0"
C_BTN_PRESS_TOP = "#0E6BA8"
C_BTN_PRESS_BOT = "#0A4F80"

C_BTN2_TOP   = "#A8DCEE"   # 보조 버튼 상단 (연한 하늘)
C_BTN2_BOT   = "#4FA8D0"   # 보조 버튼 하단
C_BTN_TEXT   = "#FFFFFF"   # 버튼 텍스트: 흰색
C_BTN_BD     = "#0D6FAA"   # 버튼 테두리: 딥 블루

# ── 텍스트 ──
C_TEXT_TITLE = "#063D6A"   # 타이틀: 딥 네이비
C_TEXT_LABEL = "#0D5A96"   # 레이블: 미드 블루
C_TEXT_BODY  = "#1A2030"   # 본문: 거의 검정

# ── 기타 ──
C_BORDER     = "#7ABDE6"   # 일반 테두리
C_ACCENT     = "#00B4D8"   # 포인트 컬러: 시안 블루
C_DISABLED   = "#A0B8CC"   # 비활성화 텍스트
C_LF_TITLE   = "#0A5A96"   # LabelFrame 타이틀 색


# ══════════════════════════════════════════════════════════════════════════ #
#  폰트 상수  (Segoe UI: Windows Aero 시대의 공식 서체)
# ══════════════════════════════════════════════════════════════════════════ #

FONT_TITLE   = ("Segoe UI", 15, "bold")   # 앱 타이틀
FONT_SECTION = ("Segoe UI", 10, "bold")   # 섹션 레이블
FONT_LABEL   = ("Segoe UI", 10)           # 일반 레이블
FONT_BTN     = ("Segoe UI", 10, "bold")   # 버튼 텍스트
FONT_CELL    = ("Segoe UI", 9)            # 그리드 셀
FONT_HDR     = ("Segoe UI", 9, "bold")    # 그리드 헤더
FONT_SMALL   = ("Segoe UI", 8)            # 작은 안내 텍스트


# ══════════════════════════════════════════════════════════════════════════ #
#  ttk 전역 테마 적용
# ══════════════════════════════════════════════════════════════════════════ #

def apply_ttk_theme(root: tk.Tk) -> ttk.Style:
    """
    'clam' 테마를 베이스로 Frutiger Aero 색상/폰트를 전역 적용한다.
    root 윈도우의 배경색도 설정한다.

    Returns
    -------
    style : ttk.Style
        추가 커스터마이즈가 필요할 때 반환된 Style 객체를 사용한다.
    """
    root.configure(bg=C_WIN_BG)

    style = ttk.Style(root)
    style.theme_use("clam")   # clam: 색상 재정의가 가장 자유로운 내장 테마

    # ── Frame ──
    style.configure("TFrame",        background=C_WIN_BG)
    style.configure("Panel.TFrame",  background=C_PANEL)

    # ── Label ──
    style.configure(
        "TLabel",
        background=C_WIN_BG,
        foreground=C_TEXT_LABEL,
        font=FONT_LABEL,
    )
    style.configure(
        "Title.TLabel",
        background=C_WIN_BG,
        foreground=C_TEXT_TITLE,
        font=FONT_TITLE,
    )
    style.configure(
        "Section.TLabel",
        background=C_WIN_BG,
        foreground=C_TEXT_LABEL,
        font=FONT_SECTION,
    )
    style.configure(
        "Panel.TLabel",
        background=C_PANEL,
        foreground=C_TEXT_LABEL,
        font=FONT_LABEL,
    )

    # ── LabelFrame ──
    style.configure(
        "TLabelframe",
        background=C_PANEL,
        bordercolor=C_BORDER,
        lightcolor=C_BORDER,
        darkcolor=C_BORDER,
        relief="solid",
        borderwidth=1,
    )
    style.configure(
        "TLabelframe.Label",
        background=C_PANEL,
        foreground=C_LF_TITLE,
        font=FONT_SECTION,
    )

    # ── Radiobutton ──
    style.configure(
        "TRadiobutton",
        background=C_WIN_BG,
        foreground=C_TEXT_LABEL,
        font=FONT_LABEL,
    )
    style.map("TRadiobutton", background=[("active", C_WIN_BG)])

    # ── Checkbutton (컬럼 필터용) ──
    style.configure(
        "Filter.TCheckbutton",
        background=C_PANEL,
        foreground=C_TEXT_LABEL,
        font=FONT_LABEL,
    )
    style.map(
        "Filter.TCheckbutton",
        background=[("active", C_PANEL)],
        foreground=[("active", C_TEXT_LABEL)],
    )

    # ── Scrollbar ──
    style.configure(
        "TScrollbar",
        background=C_BTN2_BOT,
        troughcolor=C_PANEL,
        bordercolor=C_BORDER,
        arrowcolor=C_BTN_TEXT,
        arrowsize=13,
        borderwidth=0,
    )
    style.map(
        "TScrollbar",
        background=[("active", C_BTN_BOT), ("pressed", C_BTN_BOT)],
    )

    return style


# ══════════════════════════════════════════════════════════════════════════ #
#  GlossyButton — Canvas 기반 광택 버튼
# ══════════════════════════════════════════════════════════════════════════ #

def _interp_color(c1: str, c2: str, t: float) -> str:
    """
    두 hex 색상 c1, c2 사이를 t(0.0~1.0) 비율로 선형 보간한다.
    그라데이션 각 줄의 색상 계산에 사용한다.
    """
    r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
    r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
    r = int(r1 + (r2 - r1) * t)
    g = int(g1 + (g2 - g1) * t)
    b = int(b1 + (b2 - b1) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def draw_gradient(canvas: tk.Canvas, width: int, height: int,
                  color_top: str, color_bot: str,
                  tag: str = "gradient", steps: int = 40):
    """
    canvas 위에 color_top → color_bot 세로 그라데이션을 그린다.

    Parameters
    ----------
    canvas     : 그라데이션을 그릴 Canvas 위젯
    width/height: 채울 영역 크기
    color_top  : 상단 색 (hex)
    color_bot  : 하단 색 (hex)
    tag        : Canvas 태그 (삭제·갱신 시 사용)
    steps      : 그라데이션 단계 수 (많을수록 부드럽지만 느림)
    """
    canvas.delete(tag)
    for i in range(steps):
        y0 = int(height * i / steps)
        y1 = int(height * (i + 1) / steps) + 1  # 1px 겹쳐서 틈 방지
        t = i / (steps - 1) if steps > 1 else 0
        color = _interp_color(color_top, color_bot, t)
        canvas.create_rectangle(
            0, y0, width, y1, fill=color, outline="", tags=tag
        )


class GlossyButton(tk.Canvas):
    """
    Canvas로 구현한 Frutiger Aero 스타일 광택(glossy) 버튼.

    구조:
      ┌─────────────────────┐  ← 테두리
      │  ░░ 상단 하이라이트  │  ← 위쪽 40%: 밝은 하늘색 그라데이션
      │─────────────────────│
      │     하단 그라데이션  │  ← 아래쪽 60%: 깊은 파랑 그라데이션
      └─────────────────────┘
      [          텍스트          ]
    """

    # 광택 하이라이트가 차지하는 비율 (상단 40%)
    GLOSS_RATIO = 0.42

    def __init__(self, master, text: str, command=None,
                 width: int = 130, height: int = 34,
                 top_color: str = C_BTN_TOP,
                 bot_color: str = C_BTN_BOT,
                 hover_top: str = C_BTN_HOVER_TOP,
                 hover_bot: str = C_BTN_HOVER_BOT,
                 press_top: str = C_BTN_PRESS_TOP,
                 press_bot: str = C_BTN_PRESS_BOT,
                 text_color: str = C_BTN_TEXT,
                 font=None,
                 bg: str = C_WIN_BG,
                 **kwargs):
        """
        Parameters
        ----------
        text       : 버튼에 표시할 문자열
        command    : 클릭 시 실행할 콜백
        width/height: 버튼 픽셀 크기
        top_color  : 기본 상단 색
        bot_color  : 기본 하단 색
        hover_top/bot : 마우스 오버 시 색
        press_top/bot : 클릭(눌림) 시 색
        text_color : 버튼 텍스트 색
        bg         : 버튼 바깥 배경색 (Canvas highlightbackground와 맞춰야 함)
        """
        super().__init__(
            master,
            width=width,
            height=height,
            highlightthickness=0,
            bg=bg,
            cursor="hand2",   # 마우스 올리면 손가락 커서
            **kwargs,
        )
        self._text = text
        self._command = command
        self._btn_w = width   # self._w는 tkinter 내부 Tcl 이름 변수라 충돌 → _btn_w 사용
        self._btn_h = height
        self._top    = top_color
        self._bot    = bot_color
        self._btn_h_top  = hover_top
        self._btn_h_bot  = hover_bot
        self._p_top  = press_top
        self._p_bot  = press_bot
        self._tc     = text_color
        self._font   = font or FONT_BTN

        self._state = "normal"   # "normal" | "hover" | "pressed"

        self._render()

        # 마우스 이벤트 바인딩
        self.bind("<Enter>",    self._on_enter)
        self.bind("<Leave>",    self._on_leave)
        self.bind("<Button-1>", self._on_press)
        self.bind("<ButtonRelease-1>", self._on_release)

    # ── 렌더링 ────────────────────────────────────────────────────── #

    def _render(self):
        """현재 상태(normal/hover/pressed)에 맞춰 버튼을 다시 그린다."""
        self.delete("all")

        if self._state == "hover":
            top, bot = self._btn_h_top, self._btn_h_bot
        elif self._state == "pressed":
            top, bot = self._p_top, self._p_bot
        else:
            top, bot = self._top, self._bot

        gloss_h = int(self._btn_h * self.GLOSS_RATIO)  # 광택 영역 높이

        # 1) 하단 본체 그라데이션 (전체)
        draw_gradient(self, self._btn_w, self._btn_h, top, bot, tag="body", steps=32)

        # 2) 상단 광택 하이라이트 (흰색 반투명 오버레이 효과)
        #    실제 투명도를 지원하지 않으므로, 밝은 색을 stipple로 근사한다.
        gloss_top = _interp_color("#FFFFFF", top, 0.15)  # 거의 흰색
        gloss_bot = _interp_color("#FFFFFF", top, 0.55)  # 살짝 흰색
        draw_gradient(self, self._btn_w, gloss_h,
                      gloss_top, gloss_bot, tag="gloss", steps=16)

        # 3) 테두리 (둥근 느낌을 위해 모서리 픽셀 제거)
        r = 4   # 모서리 라운드 반경
        self.create_line(r, 0, self._btn_w - r, 0, fill=C_BTN_BD, tags="border")
        self.create_line(r, self._btn_h - 1, self._btn_w - r, self._btn_h - 1, fill=C_BTN_BD, tags="border")
        self.create_line(0, r, 0, self._btn_h - r, fill=C_BTN_BD, tags="border")
        self.create_line(self._btn_w - 1, r, self._btn_w - 1, self._btn_h - r, fill=C_BTN_BD, tags="border")

        # 4) 텍스트 (약간 누른 느낌: pressed 시 1px 아래로)
        ty = self._btn_h // 2 + (1 if self._state == "pressed" else 0)
        self.create_text(
            self._btn_w // 2, ty,
            text=self._text,
            fill=self._tc,
            font=self._font,
            tags="label",
        )

    # ── 이벤트 핸들러 ─────────────────────────────────────────────── #

    def _on_enter(self, _):
        """마우스 진입 → hover 상태로 전환."""
        self._state = "hover"
        self._render()

    def _on_leave(self, _):
        """마우스 이탈 → normal 상태로 전환."""
        self._state = "normal"
        self._render()

    def _on_press(self, _):
        """마우스 버튼 누름 → pressed 상태로 전환."""
        self._state = "pressed"
        self._render()

    def _on_release(self, event):
        """
        마우스 버튼 놓음 → hover 상태로 복귀 후 command 실행.
        버튼 영역 밖에서 놓은 경우 command를 실행하지 않는다.
        """
        self._state = "hover"
        self._render()
        # 위젯 영역 안에서만 command 실행
        if 0 <= event.x <= self._btn_w and 0 <= event.y <= self._btn_h:
            if self._command:
                self._command()

    def configure(self, **kwargs):
        """text, command를 동적으로 변경할 수 있도록 configure 오버라이드."""
        if "text" in kwargs:
            self._text = kwargs.pop("text")
        if "command" in kwargs:
            self._command = kwargs.pop("command")
        if kwargs:
            super().configure(**kwargs)
        self._render()
