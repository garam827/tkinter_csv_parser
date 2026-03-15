"""
output_panel.py
출력 결과를 표시하는 읽기 전용 텍스트 패널 모듈.
- 수직/수평 스크롤바를 모두 갖춘다.
- 외부에서 set_text()를 호출해 내용을 갱신한다.
- Frutiger Aero 디자인 테마 적용 (theme.py)
"""

# =============================================================================
# ★ 이 파일의 역할
#   CSV Prefix Tool에서 '출력 미리보기' 영역을 담당하는 패널 위젯입니다.
#   사용자가 [출력 생성] 버튼을 누르면, 생성된 결과 텍스트를 여기에 표시합니다.
#   사용자는 이 영역의 내용을 직접 편집할 수 없습니다(읽기 전용).
#
# ★ 파이썬 개념: 모듈(Module)
#   파이썬에서는 .py 파일 하나를 "모듈"이라고 부릅니다.
#   큰 프로그램을 여러 모듈로 나누면 코드가 깔끔해지고 재사용하기 쉬워집니다.
# =============================================================================


# ── import ────────────────────────────────────────────────────────────────
# tkinter: 파이썬에 기본으로 포함된 GUI(그래픽 사용자 인터페이스) 라이브러리입니다.
# 별도 설치 없이 바로 사용할 수 있습니다.
import tkinter as tk

# theme.py에서 색상(C_*)과 폰트(FONT_*) 상수를 가져옵니다.
# 상수(Constant)란? 프로그램 실행 중 바뀌지 않는 값입니다. (예: C_PANEL = "#E4F4FC")
from theme import (
    C_PANEL,        # 패널 배경색 (연한 유리색)
    C_WIN_BG,       # 창 기본 배경색 (하늘색)
    C_HDR_BG,       # 헤더/스크롤바 색 (선명한 하늘 파랑)
    C_CELL_BG,      # 셀 배경색 (거의 흰색)
    C_CELL_BD,      # 셀 테두리색 (연한 파랑)
    C_TEXT_BODY,    # 본문 텍스트 색 (거의 검정)
    C_TEXT_LABEL,   # 레이블 텍스트 색 (미드 블루)
    C_LF_TITLE,     # LabelFrame 타이틀 색 (딥 블루)
    FONT_SECTION,   # 섹션 제목 폰트 (굵은 10pt)
    FONT_CELL,      # 셀/본문 폰트 (9pt)
)


# =============================================================================
# ★ 파이썬 개념: 클래스(Class)와 상속(Inheritance)
#
# 클래스란? 객체(Object)를 만들기 위한 설계도입니다.
# 예) tk.Frame은 tkinter가 제공하는 "사각형 틀" 위젯의 설계도입니다.
#
# 상속이란? 기존 클래스의 기능을 물려받아 새 클래스를 만드는 것입니다.
#   class OutputPanel(tk.Frame):  ← OutputPanel이 tk.Frame을 상속합니다.
#   이렇게 하면 OutputPanel은 tk.Frame의 모든 기능(pack, grid, config 등)을
#   자동으로 사용할 수 있고, 추가 기능만 새로 정의하면 됩니다.
#
# tk.Frame: tkinter의 기본 컨테이너 위젯으로, 다른 위젯들을 담는 "상자"입니다.
# =============================================================================
class OutputPanel(tk.Frame):
    """
    읽기 전용 텍스트 위젯과 스크롤바를 묶은 출력 미리보기 패널.
    app.py의 CSVPrefixApp이 generate_output() 결과를 여기에 표시한다.

    Frutiger Aero 스타일:
      - 패널 배경: C_PANEL (유리빛 연한 하늘)
      - 텍스트 영역 배경: C_CELL_BG (거의 흰색)
      - 스크롤바: 하늘 파랑 계열
    """

    # -------------------------------------------------------------------------
    # __init__ : 생성자(Constructor) 메서드
    # -------------------------------------------------------------------------
    # 생성자란? 클래스로 객체를 만들 때 자동으로 호출되는 메서드입니다.
    # 즉, OutputPanel(...) 처럼 괄호를 붙이면 __init__이 실행됩니다.
    #
    # 매개변수 설명:
    #   self   : 만들어지는 객체 자신을 가리키는 참조입니다.
    #            파이썬 클래스의 모든 메서드 첫 번째 인자는 관례적으로 self입니다.
    #   master : 이 패널을 담을 부모 위젯입니다. (app.py의 CSVPrefixApp 창)
    #   **kwargs : 추가 키워드 인자들을 딕셔너리로 받습니다.
    #              ** 는 "키워드 인자를 모두 묶어라"는 뜻입니다.
    #              예) bg="red", width=300 처럼 넘기면 kwargs = {"bg":"red","width":300}
    # -------------------------------------------------------------------------
    def __init__(self, master, **kwargs):
        # kwargs.setdefault("bg", C_WIN_BG)
        # setdefault란? dict에 해당 키가 없을 때만 기본값을 설정합니다.
        # 즉, 외부에서 bg를 지정하지 않았을 때만 C_WIN_BG(하늘색)를 기본값으로 씁니다.
        kwargs.setdefault("bg", C_WIN_BG)

        # super().__init__(master, **kwargs)
        # super()는 부모 클래스(tk.Frame)를 가리킵니다.
        # 부모 클래스의 __init__을 먼저 호출해야 tk.Frame의 기능이 초기화됩니다.
        # **kwargs를 넘겨서 bg 같은 옵션이 tk.Frame에도 전달됩니다.
        super().__init__(master, **kwargs)

        # UI 구성 메서드 호출
        # 밑줄(_)로 시작하는 메서드는 "내부(private)용"이라는 관례적 표시입니다.
        # 외부에서 직접 호출하지 말고, 클래스 내부에서만 사용하세요.
        self._build_ui()

    # -------------------------------------------------------------------------
    # _build_ui : UI 위젯들을 생성하고 배치하는 내부 메서드
    # -------------------------------------------------------------------------
    def _build_ui(self):
        """패널 내부 레이아웃을 구성한다."""

        # ── 섹션 제목 레이블 ──────────────────────────────────────────────
        # tk.Label: 텍스트나 이미지를 표시하는 위젯입니다. (사용자 입력 불가)
        #
        # 주요 옵션:
        #   text   : 표시할 문자열
        #   anchor : 텍스트 정렬 방향 ("w"=왼쪽, "e"=오른쪽, "center"=가운데)
        #   bg     : 배경색 (background의 줄임말)
        #   fg     : 글자색 (foreground의 줄임말)
        #   font   : 폰트 설정 (FONT_SECTION = ("Segoe UI", 10, "bold"))
        tk.Label(
            self,                   # 이 패널(self) 안에 만든다
            text="Output Preview",  # 표시할 텍스트
            anchor="w",             # 텍스트를 왼쪽 정렬
            bg=C_WIN_BG,
            fg=C_LF_TITLE,          # 딥 블루 색상
            font=FONT_SECTION,      # 굵은 10pt 폰트
        ).pack(fill=tk.X, padx=2, pady=(2, 1))
        # .pack(): 위젯을 배치하는 방법 중 하나입니다.
        #   fill=tk.X  : 가로 방향으로 꽉 채운다
        #   padx=2     : 좌우 바깥 여백 2픽셀
        #   pady=(2,1) : 위 2픽셀, 아래 1픽셀 여백

        # ── 텍스트 위젯 + 스크롤바를 담을 내부 Frame ──────────────────────
        # Frame: 다른 위젯을 담는 컨테이너 위젯입니다. (보이지 않는 상자)
        # 스크롤바와 텍스트를 함께 묶기 위해 별도 Frame을 만듭니다.
        text_frame = tk.Frame(self, bg=C_WIN_BG)
        text_frame.pack(fill=tk.BOTH, expand=True)
        # fill=tk.BOTH : 가로세로 모두 꽉 채운다
        # expand=True  : 창 크기가 늘어나면 이 위젯도 함께 늘어난다

        # ── 수직 스크롤바 (Vertical Scrollbar) ────────────────────────────
        # 스크롤바: 내용이 많아서 화면을 벗어날 때 스크롤할 수 있게 해주는 위젯
        # orient=tk.VERTICAL : 세로 방향 스크롤바
        vscroll = tk.Scrollbar(
            text_frame,                 # 부모: text_frame 안에 배치
            orient=tk.VERTICAL,         # 세로 방향
            bg=C_HDR_BG,                # 스크롤바 배경색
            troughcolor=C_PANEL,        # 스크롤바 홈(트랙) 색
            activebackground=C_WIN_BG,  # 마우스 올렸을 때 색
            relief=tk.FLAT,             # 테두리 스타일: 평평하게
        )
        # side=tk.RIGHT : text_frame의 오른쪽에 붙인다
        # fill=tk.Y     : 세로 방향으로 꽉 채운다
        vscroll.pack(side=tk.RIGHT, fill=tk.Y)

        # ── 수평 스크롤바 (Horizontal Scrollbar) ──────────────────────────
        # orient=tk.HORIZONTAL : 가로 방향 스크롤바 (긴 줄이 화면 밖으로 나갈 때 사용)
        hscroll = tk.Scrollbar(
            text_frame,
            orient=tk.HORIZONTAL,       # 가로 방향
            bg=C_HDR_BG,
            troughcolor=C_PANEL,
            activebackground=C_WIN_BG,
            relief=tk.FLAT,
        )
        # side=tk.BOTTOM : text_frame의 아래쪽에 붙인다
        # fill=tk.X      : 가로 방향으로 꽉 채운다
        hscroll.pack(side=tk.BOTTOM, fill=tk.X)

        # ── 텍스트 위젯 (읽기 전용) ────────────────────────────────────────
        # tk.Text: 여러 줄의 텍스트를 표시하거나 입력받는 위젯입니다.
        # tk.Entry가 한 줄짜리라면, tk.Text는 여러 줄을 다룹니다.
        #
        # 중요 옵션:
        #   state=tk.DISABLED : 사용자가 편집할 수 없는 읽기 전용 상태
        #                       내용을 바꾸려면 코드에서 일시적으로 NORMAL로 바꿔야 함
        #   wrap=tk.NONE      : 자동 줄바꿈 OFF → 가로 스크롤로 긴 줄 탐색
        #   yscrollcommand    : 세로 스크롤바와 연결 (내용 스크롤 시 스크롤바 이동)
        #   xscrollcommand    : 가로 스크롤바와 연결
        self._text = tk.Text(
            text_frame,
            height=8,                           # 기본 높이: 8줄
            state=tk.DISABLED,                  # 읽기 전용 (사용자 편집 불가)
            wrap=tk.NONE,                       # 자동 줄바꿈 비활성화
            yscrollcommand=vscroll.set,          # 세로 스크롤바 연결
            xscrollcommand=hscroll.set,          # 가로 스크롤바 연결
            font=FONT_CELL,                     # 9pt 폰트
            bg=C_CELL_BG,                       # 배경: 유리빛 흰색
            fg=C_TEXT_BODY,                     # 텍스트: 거의 검정
            relief=tk.SOLID,                    # 테두리 스타일: 실선
            borderwidth=1,
            highlightthickness=1,
            highlightbackground=C_CELL_BD,       # 포커스 없을 때 테두리: 연한 파랑
            highlightcolor=C_HDR_BG,             # 포커스 있을 때 테두리: 하늘 파랑
            selectbackground=C_HDR_BG,           # 텍스트 선택 배경색
            selectforeground="#FFFFFF",           # 텍스트 선택 시 글자색: 흰색
        )

        # 스크롤바 명령 연결:
        # vscroll.config(command=self._text.yview) 의 의미:
        #   스크롤바를 움직이면 텍스트 위젯의 yview 메서드가 호출되어 내용이 스크롤됩니다.
        vscroll.config(command=self._text.yview)
        hscroll.config(command=self._text.xview)

        # side=tk.LEFT  : text_frame의 왼쪽에 붙인다 (스크롤바가 오른쪽을 차지하므로)
        # fill=tk.BOTH  : 가로세로 모두 채운다
        # expand=True   : 남은 공간을 모두 사용한다
        self._text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    # -------------------------------------------------------------------------
    # set_text : 외부에서 호출해 출력 텍스트를 갱신하는 공개(public) 메서드
    # -------------------------------------------------------------------------
    # content: str  →  type hint(타입 힌트)입니다.
    # 파이썬은 자유롭게 어떤 타입이든 넘길 수 있지만,
    # 타입 힌트를 써두면 "이 인자는 문자열을 넘겨야 해요"라고 알려줄 수 있습니다.
    # 실제 실행에는 영향을 주지 않고, IDE(편집기)가 도움말을 보여주는 데 사용합니다.
    def set_text(self, content: str):
        """
        출력 텍스트를 갱신한다.
        텍스트 위젯은 평소 DISABLED(읽기 전용) 상태이므로,
        내용을 변경할 때만 잠시 NORMAL로 전환한 뒤 다시 잠근다.
        """
        # 1단계: DISABLED → NORMAL 전환 (편집 가능 상태로 변경)
        # 읽기 전용 상태에서는 delete/insert가 동작하지 않으므로 반드시 필요합니다.
        self._text.config(state=tk.NORMAL)

        # 2단계: 기존 내용 전체 삭제
        # "1.0" = 1행 0번째 문자 (텍스트 위젯의 좌표 표기법: "행.열")
        # tk.END = 텍스트 끝을 나타내는 tkinter 상수
        self._text.delete("1.0", tk.END)

        # 3단계: 새 내용 삽입 ("1.0" = 맨 처음 위치에 삽입)
        self._text.insert("1.0", content)

        # 4단계: 다시 DISABLED(읽기 전용)로 잠금
        # 사용자가 임의로 수정하지 못하도록 잠급니다.
        self._text.config(state=tk.DISABLED)
