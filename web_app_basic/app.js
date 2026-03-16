/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  app.js — CSV Prefix Tool 메인 로직  (기본 버전 · Sample Code 없음)     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  이 파일이 담당하는 기능:                                                ║
 * ║    1. CSV 그리드 생성 및 관리 (행/열 추가·삭제, 셀 이동)                 ║
 * ║    2. 클립보드 붙여넣기 (Ctrl+V, 구분자 자동 감지)                       ║
 * ║    3. CSV 파일 불러오기 (FileReader API)                                 ║
 * ║    4. 컬럼 필터 (출력에 포함할 열 선택)                                  ║
 * ║    5. 출력 생성 (접두 문자열 + CSV 데이터 조합)                          ║
 * ║    6. 파일 저장 (Blob + <a download>) 및 클립보드 복사                   ║
 * ║    7. 토스트 알림 및 전역 단축키 (Ctrl+Enter)                            ║
 * ║                                                                          ║
 * ║  파이썬 버전과의 대응:                                                   ║
 * ║    grid_widget.py  → buildGrid, addRow/Col, handlePaste, handleCellKeydown ║
 * ║    app.py          → generateOutput, saveToFile, copyToClipboard         ║
 * ║    output_panel.py → updatePreview                                       ║
 * ║    theme.py        → style.css                                           ║
 * ║                                                                          ║
 * ║  사용된 주요 Web API:                                                    ║
 * ║    ClipboardEvent          붙여넣기 이벤트 처리                          ║
 * ║    FileReader              로컬 파일 읽기                                ║
 * ║    Blob + <a download>     파일 다운로드                                 ║
 * ║    navigator.clipboard     클립보드 쓰기                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

'use strict';
/*
  'use strict' — 엄격 모드 선언
  ───────────────────────────────
  활성화되면 다음 실수를 런타임 오류로 잡아줌:
  - 선언 없이 변수 사용 (오타로 인한 전역 변수 생성 방지)
  - 예약어를 변수명으로 사용
  - this 가 undefined 인 상황에서 전역 객체 대신 undefined 반환
*/


/* ════════════════════════════════════════════════════════════════════════════
   전역 상태(State) 변수
   ────────────────────────────────────────────────────────────────────────
   앱 전반에서 공유되는 데이터.
   let 으로 선언: 재할당 가능 (행/열 수가 변함)
════════════════════════════════════════════════════════════════════════════ */

/**
 * 그리드 현재 행(Row) 수
 * 초깃값 10: 앱 로드 시 10행으로 시작
 * addRow() / deleteRow() / 붙여넣기 시 자동 확장 → 값이 변경됨
 */
let ROWS = 10;

/**
 * 그리드 현재 열(Column) 수
 * 초깃값 6: 앱 로드 시 A~F 6개 열로 시작
 */
let COLS = 6;

/**
 * 컬럼 필터 상태 객체
 * ─────────────────────────────────────────────
 * 형식: { 열인덱스(number): true/false }
 * 예)  { 0:true, 1:true, 2:false, 3:true }
 *       → A열·B열·D열 출력 포함, C열 제외
 *
 * true  = 출력에 포함
 * false = 출력에서 제외
 */
let colFilter = {};

/**
 * 가장 최근에 generateOutput()이 만든 출력 문자열
 * saveToFile()과 copyToClipboard()가 이 값을 사용
 * 출력 생성 전: 빈 문자열 → 저장/복사 시 경고 표시
 */
let lastOutput = '';


/* ════════════════════════════════════════════════════════════════════════════
   열 이름 변환 유틸리티
════════════════════════════════════════════════════════════════════════════ */

/**
 * 열 인덱스(0-based)를 엑셀 스타일 열 이름으로 변환한다.
 *
 * 변환 예시:
 *    0  →  'A'        (첫 번째 열)
 *   25  →  'Z'        (26번째 열)
 *   26  →  'AA'       (27번째 열, 두 자리로 넘어감)
 *   27  →  'AB'
 *   701 →  'ZZ'
 *
 * 알고리즘 — 26진수 변환:
 *   일반 10진수→26진수와 달리 'A'=1, 'Z'=26 으로 1-based 임에 주의
 *   n = idx + 1  (0-based → 1-based)
 *   반복:
 *     rem = (n-1) % 26       → 현재 자리 값 (0~25 → 'A'~'Z')
 *     label = 문자 + label   → 앞에 문자를 붙임 (낮은 자리가 오른쪽)
 *     n = floor((n-1) / 26)  → 다음 자리로 올림
 *
 * @param {number} idx - 0부터 시작하는 열 인덱스
 * @returns {string} 열 이름 (예: 'A', 'Z', 'AA', 'AB')
 */
function getColLabel(idx) {
  let label = '';
  let n = idx + 1;   // 1-based 로 변환

  while (n > 0) {
    const rem = (n - 1) % 26;                       // 현재 자리: 0→A, 25→Z
    label = String.fromCharCode(65 + rem) + label;  // 65 = 'A' 의 ASCII 코드
    n = Math.floor((n - 1) / 26);                   // 다음 자리 계산
  }

  return label;
}


/* ════════════════════════════════════════════════════════════════════════════
   그리드 구성 — 테이블 동적 생성
════════════════════════════════════════════════════════════════════════════ */

/**
 * #csv-grid 테이블을 현재 ROWS × COLS 크기로 다시 빌드한다.
 *
 * 생성 구조:
 *   <table id="csv-grid">
 *     <thead>
 *       <tr>
 *         <th></th>      ← 코너 셀 (행번호/열헤더 교차점)
 *         <th>A</th>     ← 열 헤더
 *         <th>B</th>
 *         ...
 *       </tr>
 *     </thead>
 *     <tbody>
 *       <tr>
 *         <td class="row-num">1</td>   ← 행 번호
 *         <td class="data-cell"><input data-row="0" data-col="0"></td>
 *         ...
 *       </tr>
 *       ...
 *     </tbody>
 *   </table>
 *
 * @param {string[][]|null} savedData
 *   그리드 재빌드 전 saveGridData()로 백업한 데이터.
 *   행/열 추가·삭제 시 기존 데이터를 유지하기 위해 전달.
 *   null 이면 빈 그리드로 시작.
 */
function buildGrid(savedData = null) {
  const table = document.getElementById('csv-grid');
  table.innerHTML = '';   // 기존 테이블 내용 초기화

  // ── ① 헤더 행 (<thead>) ──────────────────────────────────────────────────
  const thead = table.createTHead();   // <thead> 생성 & table 에 추가
  const hrow  = thead.insertRow();     // <tr> 생성 & thead 에 추가

  // 코너 셀: 행번호 열과 열헤더 행이 만나는 왼쪽 상단 빈 칸
  const corner = document.createElement('th');
  corner.textContent = '';
  hrow.appendChild(corner);

  // 열 헤더: A, B, C, ... 순으로 생성
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement('th');
    th.textContent = getColLabel(c);   // 인덱스 → 'A', 'B', 'AA', ...
    hrow.appendChild(th);
  }

  // ── ② 데이터 행 (<tbody>) ────────────────────────────────────────────────
  const tbody = table.createTBody();

  for (let r = 0; r < ROWS; r++) {
    const tr = tbody.insertRow();

    // 행 번호 셀 (파란 헤더 스타일, 1-based)
    const numTd = document.createElement('td');
    numTd.className   = 'row-num';
    numTd.textContent = r + 1;   // 0-based 인덱스 → 1-based 화면 번호
    tr.appendChild(numTd);

    // 데이터 입력 셀: 열 수만큼 반복
    for (let c = 0; c < COLS; c++) {
      const td = document.createElement('td');
      td.className = 'data-cell';

      const input = document.createElement('input');
      input.type = 'text';

      /*
        data-row, data-col 속성:
          어떤 위치의 셀인지 HTML 속성으로 저장
          getCell(r, c) → querySelector('input[data-row="r"][data-col="c"]')
          로 이 속성을 검색해 셀을 찾음
      */
      input.setAttribute('data-row', r);
      input.setAttribute('data-col', c);

      // 행/열 추가·삭제 후 기존 데이터 복원
      if (savedData && savedData[r] && savedData[r][c] !== undefined) {
        input.value = savedData[r][c];
      }

      // 이벤트 리스너 등록
      input.addEventListener('keydown', handleCellKeydown);  // 셀 이동
      input.addEventListener('paste',   handlePaste);        // 붙여넣기

      td.appendChild(input);
      tr.appendChild(td);
    }
  }

  // ── ③ 컬럼 필터 갱신 ─────────────────────────────────────────────────────
  // 열 수가 바뀌었을 수 있으므로 체크박스 UI 재생성 필요
  refreshColFilter();
}


/**
 * 현재 그리드의 모든 셀 값을 2D 배열로 저장하고 반환한다.
 * buildGrid() 호출 전 기존 데이터를 백업하는 용도.
 *
 * 반환 형식:
 *   [
 *     ['A1값', 'B1값', 'C1값', ...],   ← 1행
 *     ['A2값', 'B2값', 'C2값', ...],   ← 2행
 *     ...
 *   ]
 *
 * @returns {string[][]} 현재 그리드 전체 데이터
 */
function saveGridData() {
  const data = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const input = getCell(r, c);
      row.push(input ? input.value : '');  // 셀 없으면 빈 문자열
    }
    data.push(row);
  }

  return data;
}


/**
 * (r, c) 위치의 <input> 요소를 반환한다.
 *
 * 구현 방법:
 *   document.querySelector 로 data-row, data-col 속성이 일치하는 input 검색
 *   예) getCell(2, 1) → input[data-row="2"][data-col="1"] → 3행 B열 input
 *
 * @param {number} r - 행 인덱스 (0-based: 화면 1행 = r:0)
 * @param {number} c - 열 인덱스 (0-based: A열 = c:0)
 * @returns {HTMLInputElement|null}
 */
function getCell(r, c) {
  return document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
}


/* ════════════════════════════════════════════════════════════════════════════
   키보드 셀 이동 — Tab / Enter / 방향키
════════════════════════════════════════════════════════════════════════════ */

/**
 * 셀 <input> 에서 특수 키를 눌렀을 때 다른 셀로 포커스를 이동한다.
 *
 * 이동 규칙:
 *   Tab         → 오른쪽 셀. 열 끝이면 다음 행 첫 번째 셀로 이동
 *   Shift+Tab   → 왼쪽 셀. 열 처음이면 이전 행 마지막 셀로 이동
 *   Enter       → 아래쪽 셀 (마지막 행이면 이동 없음)
 *   ArrowDown   → 아래쪽 셀
 *   ArrowUp     → 위쪽 셀
 *   ArrowRight  → 커서가 텍스트 맨 끝일 때만 오른쪽 셀로 이동
 *   ArrowLeft   → 커서가 텍스트 맨 앞일 때만 왼쪽 셀로 이동
 *
 * @this {HTMLInputElement} 이벤트가 발생한 셀의 input 요소
 * @param {KeyboardEvent} e
 */
function handleCellKeydown(e) {
  // 현재 셀 위치
  const r = parseInt(this.getAttribute('data-row'));
  const c = parseInt(this.getAttribute('data-col'));

  // 이동할 목표 위치 (기본값: 현재 위치 유지)
  let nr = r, nc = c;

  if (e.key === 'Tab') {
    e.preventDefault();   // 기본 Tab 동작(페이지 내 포커스 이동) 차단
    if (e.shiftKey) {
      // Shift+Tab: 왼쪽 이동
      if (nc > 0)      { nc--; }                // 왼쪽 셀
      else if (nr > 0) { nr--; nc = COLS - 1; } // 첫 열이면 위 행 마지막 열
    } else {
      // Tab: 오른쪽 이동
      if (nc < COLS - 1)      { nc++; }         // 오른쪽 셀
      else if (nr < ROWS - 1) { nr++; nc = 0; } // 마지막 열이면 다음 행 첫 열
    }

  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (nr < ROWS - 1) nr++;   // 아래 셀 (마지막 행이면 이동 없음)

  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (nr < ROWS - 1) nr++;

  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (nr > 0) nr--;

  } else if (e.key === 'ArrowRight') {
    /*
      selectionStart: 현재 커서(캐럿) 위치 (0 = 텍스트 맨 앞)
      this.value.length: 텍스트 길이 (= 맨 끝 커서 위치)
      커서가 텍스트 끝에 있을 때만 오른쪽 셀로 이동 (텍스트 내 이동은 유지)
    */
    if (this.selectionStart === this.value.length && nc < COLS - 1) nc++;
    else return;

  } else if (e.key === 'ArrowLeft') {
    if (this.selectionStart === 0 && nc > 0) nc--;
    else return;

  } else {
    return;   // 위에서 처리되지 않은 키: 브라우저 기본 동작 유지
  }

  // 목표 셀에 포커스 이동
  const target = getCell(nr, nc);
  if (target) target.focus();
}


/* ════════════════════════════════════════════════════════════════════════════
   붙여넣기 (Ctrl+V) — 구분자 자동 감지 후 그리드 채우기
════════════════════════════════════════════════════════════════════════════ */

/**
 * 셀에서 paste 이벤트 발생 시 호출된다.
 *
 * 처리 순서:
 *   1. 브라우저 기본 붙여넣기 차단 (input 에 그냥 텍스트 삽입되는 것 방지)
 *   2. ClipboardEvent.clipboardData 에서 텍스트 추출
 *   3. parseClipboard() 로 2D 배열 변환 (구분자 자동 감지)
 *   4. 현재 셀(startR, startC)부터 그리드에 값 입력
 *   5. 그리드 범위를 넘으면 ROWS/COLS 확장 후 buildGrid() 재호출
 *
 * @this {HTMLInputElement} 붙여넣기가 발생한 input 요소
 * @param {ClipboardEvent} e
 */
function handlePaste(e) {
  e.preventDefault();   // 기본 붙여넣기(input 에 텍스트 삽입) 차단

  // 클립보드에서 순수 텍스트(plain text) 추출
  const text = e.clipboardData.getData('text/plain');
  if (!text.trim()) return;

  // 붙여넣기 시작 위치 (현재 포커스된 셀)
  const startR = parseInt(this.getAttribute('data-row'));
  const startC = parseInt(this.getAttribute('data-col'));

  // 텍스트 → 2D 배열 파싱
  const rows = parseClipboard(text);
  if (!rows || rows.length === 0) return;

  // 붙여넣기 후 필요한 최대 행/열 계산
  const needR = startR + rows.length;
  const needC = startC + Math.max(...rows.map(row => row.length));

  // 현재 그리드보다 크면 확장
  if (needR > ROWS || needC > COLS) {
    const saved = saveGridData();           // 기존 데이터 백업
    ROWS = Math.max(needR, ROWS);
    COLS = Math.max(needC, COLS);
    buildGrid(saved);                       // 확장된 그리드 재빌드
  }

  // 각 셀에 데이터 입력
  rows.forEach((row, dr) => {          // dr: 시작 행으로부터의 행 오프셋
    row.forEach((val, dc) => {         // dc: 시작 열로부터의 열 오프셋
      const cell = getCell(startR + dr, startC + dc);
      if (cell) cell.value = val;
    });
  });
}


/**
 * 클립보드 텍스트를 2D 배열로 파싱한다.
 * 구분자를 자동으로 감지한다.
 *
 * 감지 우선순위: 탭(\t) → 쉼표(,) → 세미콜론(;)
 * 각 구분자로 나눠봐서 2열 이상이 나오면 그 구분자를 사용.
 * 모두 단일 열이면 줄 단위 단일 열 배열로 반환.
 *
 * 사용 예시:
 *   엑셀에서 복사 → 탭 구분자 감지
 *   CSV 텍스트 → 쉼표 감지
 *   유럽 CSV   → 세미콜론 감지
 *
 * @param {string} text - 클립보드 원문
 * @returns {string[][]} 파싱된 2D 배열
 */
function parseClipboard(text) {
  // 줄 분리: \r\n(Windows) 과 \n(Unix/Mac) 모두 처리
  const lines = text.split(/\r?\n/);

  // 마지막 빈 줄 제거 (엑셀 복사 시 끝에 빈 줄이 포함되는 경우 처리)
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  // 우선순위대로 구분자 시도
  for (const delim of ['\t', ',', ';']) {
    const rows = lines.map(line => line.split(delim));
    // some(): 하나라도 조건을 만족하면 true
    if (rows.some(row => row.length > 1)) return rows;
  }

  // 구분자 미감지: 각 줄을 1열로 처리
  return lines.map(line => [line]);
}


/* ════════════════════════════════════════════════════════════════════════════
   행/열 추가·삭제 — 그리드 크기 동적 조정
════════════════════════════════════════════════════════════════════════════ */

/**
 * 그리드 아래에 빈 행 1개 추가.
 *
 * 패턴: saveGridData() → ROWS 증가 → buildGrid(saved)
 * → 이 패턴은 모든 행/열 조작에서 동일하게 사용됨 (데이터 보존 원칙)
 */
function addRow() {
  const saved = saveGridData();   // 현재 데이터 백업
  ROWS++;
  buildGrid(saved);               // 백업 데이터 포함해 재빌드
}

/**
 * 마지막 행 삭제.
 *
 * 제약:
 *   - 최소 1행 유지 (ROWS <= 1 이면 무시)
 *   - 마지막 행에 데이터가 있으면 confirm 으로 사용자 확인 후 삭제
 */
function deleteRow() {
  if (ROWS <= 1) return;

  // 마지막 행의 모든 셀을 검사해 데이터 유무 확인
  // Array.from({length:n}, (_,i)=>i): [0,1,2,...,n-1] 배열 생성
  const lastRowHasData = Array.from({ length: COLS }, (_, c) => getCell(ROWS - 1, c))
    .some(cell => cell && cell.value.trim() !== '');

  if (lastRowHasData && !confirm(`${ROWS}행에 데이터가 있습니다. 삭제하시겠습니까?`)) return;

  const saved = saveGridData();
  ROWS--;
  buildGrid(saved);
}

/**
 * 그리드 오른쪽에 빈 열 1개 추가.
 */
function addCol() {
  const saved = saveGridData();
  COLS++;
  buildGrid(saved);
}

/**
 * 마지막 열 삭제.
 *
 * 제약:
 *   - 최소 1열 유지
 *   - 마지막 열에 데이터가 있으면 confirm 확인
 */
function deleteCol() {
  if (COLS <= 1) return;

  const lastColHasData = Array.from({ length: ROWS }, (_, r) => getCell(r, COLS - 1))
    .some(cell => cell && cell.value.trim() !== '');

  const colName = getColLabel(COLS - 1);  // 삭제될 열 이름 (예: 'F')
  if (lastColHasData && !confirm(`'${colName}'열에 데이터가 있습니다. 삭제하시겠습니까?`)) return;

  const saved = saveGridData();
  COLS--;
  buildGrid(saved);
}

/**
 * 그리드의 모든 셀 값을 지운다.
 * ROWS/COLS 는 유지하고 데이터만 초기화.
 * confirm 으로 실수 방지.
 */
function confirmClear() {
  if (!confirm('그리드의 모든 데이터를 초기화하시겠습니까?')) return;

  /*
    querySelectorAll: CSS 선택자로 일치하는 모든 요소를 NodeList 로 반환
    forEach: NodeList 를 순회하며 각 input 의 value 를 빈 문자열로 설정
  */
  document.querySelectorAll('#csv-grid input').forEach(input => {
    input.value = '';
  });
}


/* ════════════════════════════════════════════════════════════════════════════
   컬럼 필터 — 출력에 포함할 열 선택
════════════════════════════════════════════════════════════════════════════ */

/**
 * 현재 COLS 수에 맞게 컬럼 필터 체크박스 UI를 다시 그린다.
 *
 * 처리 순서:
 *   1. 기존 체크박스 전부 제거
 *   2. COLS 범위를 벗어난 colFilter 항목 삭제 (열 삭제 후 잔여 데이터 정리)
 *   3. 새로 추가된 열은 colFilter[c] = true (기본: 선택)
 *   4. 각 열마다 pill 형태의 label + checkbox 생성
 *
 * 이 함수는 buildGrid() 마지막에서 항상 호출됨.
 */
function refreshColFilter() {
  const container = document.getElementById('col-filter-checkboxes');
  container.innerHTML = '';   // 기존 체크박스 제거

  // COLS 범위 밖의 상태값 제거
  Object.keys(colFilter).forEach(k => {
    if (parseInt(k) >= COLS) delete colFilter[k];
  });

  for (let c = 0; c < COLS; c++) {
    // 새 열은 기본값 true (선택)
    if (!(c in colFilter)) colFilter[c] = true;

    // <label class="col-checkbox-label [unchecked]">
    const label = document.createElement('label');
    label.className = 'col-checkbox-label' + (colFilter[c] ? '' : ' unchecked');

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = colFilter[c];

    // 체크 상태 변경 시
    cb.addEventListener('change', () => {
      colFilter[c] = cb.checked;
      /*
        classList.toggle(className, force):
          force=true  → 클래스 추가
          force=false → 클래스 제거
        !cb.checked → 체크 해제 시 .unchecked 추가, 체크 시 제거
      */
      label.classList.toggle('unchecked', !cb.checked);
    });

    label.appendChild(cb);
    label.appendChild(document.createTextNode(getColLabel(c)));  // 'A', 'B', ...
    container.appendChild(label);
  }
}

/** 모든 열 체크박스를 선택 상태로 전환 */
function selectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = true;
  refreshColFilter();
}

/** 모든 열 체크박스를 해제 상태로 전환 */
function deselectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = false;
  refreshColFilter();
}


/* ════════════════════════════════════════════════════════════════════════════
   CSV 파일 불러오기 — FileReader API
════════════════════════════════════════════════════════════════════════════ */

/**
 * 숨겨진 <input type="file"> 요소를 프로그래밍적으로 클릭한다.
 * "CSV 불러오기" 버튼 → 이 함수 → 파일 선택 대화상자 열림
 */
function triggerFileLoad() {
  document.getElementById('csv-file-input').click();
}

/**
 * 파일이 선택됐을 때 FileReader API로 CSV 내용을 읽어 그리드에 로드한다.
 *
 * FileReader API 비동기 처리 흐름:
 *   ① new FileReader() 객체 생성
 *   ② reader.onload = callback 등록 (읽기 완료 시 실행될 함수)
 *   ③ reader.readAsText(file, 'UTF-8') 호출 → 비동기로 파일 읽기 시작
 *   ④ 읽기 완료 → onload 콜백 실행 → ev.target.result 에 텍스트
 *   ⑤ onerror 콜백: 읽기 실패 시 실행
 *
 * @param {Event} e - input[type=file] 의 change 이벤트
 */
function loadCSVFile(e) {
  const file = e.target.files[0];   // 선택된 첫 번째 파일 객체
  if (!file) return;                 // 취소 시 무시

  const reader = new FileReader();

  // 파일 읽기 완료 콜백 (비동기: 읽기가 끝나면 자동 호출)
  reader.onload = (ev) => {
    const text = ev.target.result;   // 파일 전체 내용 (문자열)

    // 줄 분리 → 빈 줄 제거 → 쉼표로 열 분리 → 2D 배열
    const rows = text
      .split(/\r?\n/)               // OS별 줄바꿈 차이 처리
      .filter(line => line.trim())  // 빈 줄 제거
      .map(line => line.split(','));

    // 기존 그리드보다 크면 확장
    const newRows = Math.max(rows.length, ROWS);
    const newCols = Math.max(Math.max(...rows.map(r => r.length)), COLS);

    ROWS = newRows;
    COLS = newCols;
    buildGrid();   // savedData 없이 빌드 (아래 루프에서 직접 채움)

    // 각 셀에 파일 데이터 입력
    rows.forEach((row, r) => {
      row.forEach((val, c) => {
        const cell = getCell(r, c);
        if (cell) {
          /*
            정규식 ^"|"$ :
              ^ = 문자열 시작, " = 큰따옴표, $ = 문자열 끝
              replace(정규식, '') → 앞뒤 따옴표만 제거 (CSV 따옴표 처리)
          */
          cell.value = val.replace(/^"|"$/g, '');
        }
      });
    });

    showToast(`✅ '${file.name}' 불러오기 완료`);
  };

  reader.onerror = () => showToast('❌ 파일을 읽을 수 없습니다.');
  reader.readAsText(file, 'UTF-8');   // UTF-8 로 텍스트 읽기 시작

  /*
    e.target.value = '' : 같은 파일을 다시 선택 가능하도록 초기화
    (초기화 안 하면 동일 파일 재선택 시 change 이벤트 미발생)
  */
  e.target.value = '';
}


/* ════════════════════════════════════════════════════════════════════════════
   출력 생성 — 접두 문자열 + CSV 데이터 조합
════════════════════════════════════════════════════════════════════════════ */

/**
 * 구분자 라디오 버튼 중 현재 선택된 값을 반환한다.
 * name="sep" 인 radio 중 :checked 상태인 것의 value 를 읽음.
 *
 * @returns {string} ',' | '\t' | ';'
 */
function getSelectedSep() {
  return document.querySelector('input[name="sep"]:checked').value;
}

/**
 * 그리드에서 selectedCols 열만 추출해 2D 배열로 반환한다.
 * 모든 셀이 비어있는 행은 결과에서 제외한다.
 *
 * @param {number[]} selectedCols - 포함할 열 인덱스 배열 (예: [0, 2, 4])
 * @returns {string[][]} 필터링된 데이터
 */
function getGridData(selectedCols) {
  const result = [];

  for (let r = 0; r < ROWS; r++) {
    const row = selectedCols.map(c => {
      const cell = getCell(r, c);
      return cell ? cell.value : '';
    });

    // 행의 모든 셀이 비어있으면 건너뜀 (빈 행 제외)
    if (row.some(v => v.trim() !== '')) {
      result.push(row);
    }
  }

  return result;
}

/**
 * 2D 배열을 CSV 형식 문자열로 변환한다.
 *
 * RFC 4180 CSV 규칙 적용:
 *   - 값에 구분자·큰따옴표·줄바꿈이 포함되면 큰따옴표로 감쌈
 *   - 값 안의 큰따옴표(") 는 ""(두 개) 로 이스케이프
 *
 * 예시 (구분자 = ','):
 *   [['홍길동', '서울,강남'], ['이순신', '부산']]
 *   → '홍길동,"서울,강남"\n이순신,부산'
 *
 * @param {string[][]} data - 변환할 2D 배열
 * @param {string}     sep  - 구분자 문자
 * @returns {string} CSV 형식 문자열
 */
function toCSVString(data, sep) {
  return data
    .map(row =>
      row.map(v => {
        // 값에 구분자·따옴표·줄바꿈이 있으면 따옴표로 감쌈
        if (v.includes(sep) || v.includes('"') || v.includes('\n')) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      }).join(sep)    // 열을 구분자로 연결
    )
    .join('\n');      // 행을 줄바꿈으로 연결
}

/**
 * 접두 문자열과 CSV 데이터를 조합해 최종 출력을 생성한다.
 * 결과는 미리보기에 표시되고 lastOutput 에 저장된다.
 *
 * 조합 규칙:
 *   선택 열 없음     → 경고 (출력 불가)
 *   둘 다 비어있음   → 경고 (출력 불가)
 *   접두만 있음      → 접두만 출력
 *   CSV만 있음       → CSV만 출력
 *   둘 다 있음       → 접두 + '\n' + CSV
 */
function generateOutput() {
  // ① 선택된 열 인덱스 수집
  //    Object.entries: 객체 → [['키','값'], ...] 배열
  //    filter: value 가 true 인 것만
  //    map: key 를 string → number 로 변환
  const selectedCols = Object.entries(colFilter)
    .filter(([, v]) => v)
    .map(([k]) => parseInt(k));

  if (selectedCols.length === 0) {
    showToast('⚠️ 출력할 열을 하나 이상 선택해주세요.');
    return;
  }

  // ② 접두 문자열 및 CSV 데이터 수집
  const prefix   = document.getElementById('prefix-text').value.trimEnd();
  const sep      = getSelectedSep();
  const gridData = getGridData(selectedCols);
  const csvStr   = gridData.length > 0 ? toCSVString(gridData, sep) : '';

  // ③ 둘 다 비어있으면 경고
  if (!prefix.trim() && !csvStr) {
    showToast('⚠️ 그리드와 접두 문자열이 모두 비어있습니다.');
    return;
  }

  // ④ 조합
  if (prefix.trim() && csvStr)  lastOutput = prefix + '\n' + csvStr;
  else if (prefix.trim())       lastOutput = prefix;
  else                          lastOutput = csvStr;

  // ⑤ 미리보기 갱신 + 완료 알림
  updatePreview(lastOutput);
  showToast('✅ 출력이 생성되었습니다.');
}

/**
 * 출력 미리보기 <pre id="output-preview"> 의 내용을 갱신한다.
 *
 * textContent 사용 이유:
 *   innerHTML 대신 textContent 를 쓰면 입력값의 HTML 태그가 렌더링되지 않음
 *   → XSS(크로스 사이트 스크립팅) 공격 방지
 *
 * @param {string} text - 표시할 출력 문자열
 */
function updatePreview(text) {
  document.getElementById('output-preview').textContent = text;
}


/* ════════════════════════════════════════════════════════════════════════════
   파일 저장 — Blob + <a download>
════════════════════════════════════════════════════════════════════════════ */

/**
 * lastOutput 을 output.csv 파일로 다운로드한다.
 *
 * 브라우저에서 파일 저장 구현 원리:
 *   1. new Blob([내용], {type: 'text/csv'})
 *      → 파일 내용을 메모리에 담는 Binary Large Object 생성
 *   2. URL.createObjectURL(blob)
 *      → 'blob:http://...' 형태의 임시 URL 생성 (브라우저 내부 메모리 참조)
 *   3. <a href=임시URL download=파일명>.click()
 *      → 브라우저가 해당 URL의 내용을 파일로 다운로드
 *   4. URL.revokeObjectURL(url)
 *      → 임시 URL 해제 (메모리 누수 방지)
 */
function saveToFile() {
  if (!lastOutput) {
    showToast('⚠️ 먼저 출력을 생성해주세요.');
    return;
  }

  const blob = new Blob([lastOutput], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  // 임시 <a> 태그 생성 → 클릭 → 제거
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'output.csv';
  document.body.appendChild(a);    // DOM 에 추가해야 click() 동작
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);         // 메모리 해제

  showToast('✅ 파일이 저장되었습니다.');
}


/* ════════════════════════════════════════════════════════════════════════════
   클립보드 복사 — Clipboard API
════════════════════════════════════════════════════════════════════════════ */

/**
 * lastOutput 을 클립보드에 복사한다.
 *
 * navigator.clipboard.writeText() 특징:
 *   - 현대적인 Clipboard API (Promise 기반 비동기)
 *   - HTTPS 환경 또는 localhost 에서만 동작 (보안 제한)
 *   - .then(): 성공 시 콜백, .catch(): 실패 시 콜백
 *
 * 실패 시 fallback (document.execCommand):
 *   - 구식 방식이지만 로컬 file:// 환경에서도 동작
 *   - 임시 textarea 생성 → 텍스트 삽입 → 전체 선택 → 복사 명령
 */
function copyToClipboard() {
  if (!lastOutput) {
    showToast('⚠️ 먼저 출력을 생성해주세요.');
    return;
  }

  navigator.clipboard.writeText(lastOutput)
    .then(() => showToast('✅ 클립보드에 복사되었습니다.'))
    .catch(() => {
      // Clipboard API 실패 시 구형 방식으로 재시도
      const ta       = document.createElement('textarea');
      ta.value       = lastOutput;
      ta.style.position = 'fixed';   // 스크롤 위치 변경 방지
      ta.style.opacity  = '0';       // 화면에 보이지 않게
      document.body.appendChild(ta);
      ta.select();                   // 텍스트 전체 선택
      document.execCommand('copy');  // 복사 명령 실행
      document.body.removeChild(ta);
      showToast('✅ 클립보드에 복사되었습니다.');
    });
}


/* ════════════════════════════════════════════════════════════════════════════
   토스트 알림 — 화면 하단 팝업 메시지
════════════════════════════════════════════════════════════════════════════ */

/** 토스트 자동 닫기 타이머 ID (연속 호출 시 이전 타이머 취소용) */
let toastTimer = null;

/**
 * 화면 하단에 잠깐 나타났다 사라지는 알림 메시지를 표시한다.
 *
 * 동작 순서:
 *   1. #toast 의 텍스트 설정
 *   2. .show 클래스 추가 → CSS transition: opacity 0→1, translateY 페이드인
 *   3. duration ms 후 .show 제거 → 페이드아웃
 *
 * clearTimeout: 메시지가 표시 중에 새 메시지가 오면 타이머를 초기화해
 *   이전 메시지가 새 메시지 직후 사라지지 않도록 방지
 *
 * @param {string} msg           - 표시할 메시지 (이모지 포함 가능)
 * @param {number} [duration=2200] - 표시 유지 시간 (밀리초)
 */
function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}


/* ════════════════════════════════════════════════════════════════════════════
   전역 단축키
════════════════════════════════════════════════════════════════════════════ */

/*
  document.addEventListener('keydown', ...):
    페이지 전체에서 키보드 이벤트를 감지
    어떤 요소에 포커스가 있든 동작 (전역 단축키)

  Ctrl+Enter → 출력 생성 (generateOutput 호출)
  e.ctrlKey : Ctrl 키가 눌려있으면 true
  e.key === 'Enter' : Enter 키
*/
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();   // 브라우저 기본 동작 (폼 제출 등) 차단
    generateOutput();
  }
});


/* ════════════════════════════════════════════════════════════════════════════
   초기화 — 페이지 로드 시 실행
════════════════════════════════════════════════════════════════════════════ */

/*
  DOMContentLoaded 이벤트:
    HTML 문서 파싱 완료 → DOM 트리 준비 완료 시 발생
    (이미지, CSS, 외부 폰트 로드 완료는 기다리지 않음)

  <script src="app.js"> 는 </body> 바로 앞에 있으므로
  실제로는 HTML 이 거의 다 파싱된 후 실행되지만,
  DOMContentLoaded 를 사용하면 코드 위치에 관계없이 안전하게 초기화 가능
*/
document.addEventListener('DOMContentLoaded', () => {
  buildGrid();   // 기본 10행 × 6열 빈 그리드 생성
});
