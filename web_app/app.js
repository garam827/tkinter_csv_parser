/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  app.js — CSV Prefix Tool 메인 로직                                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  역할: 그리드 조작, 붙여넣기, 파일 입출력, 출력 생성 등                 ║
 * ║        모든 '동작'을 담당하는 JavaScript 파일                            ║
 * ║                                                                          ║
 * ║  파이썬 버전과의 대응:                                                   ║
 * ║    CSVGrid      → buildGrid(), addRow/Col, deleteRow/Col, handlePaste   ║
 * ║    CSVPrefixApp → generateOutput(), saveToFile(), copyToClipboard()     ║
 * ║    OutputPanel  → updatePreview()                                       ║
 * ║    theme.py     → style.css (JS에서 담당하지 않음)                      ║
 * ║                                                                          ║
 * ║  주요 Web API:                                                           ║
 * ║    ClipboardEvent         붙여넣기 (Ctrl+V) 이벤트 처리                 ║
 * ║    FileReader API         로컬 CSV 파일 읽기                             ║
 * ║    Blob + <a download>    파일 저장 (다운로드)                           ║
 * ║    navigator.clipboard    클립보드 복사                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

'use strict';
// 'use strict': 엄격 모드 선언
// → 오타로 인한 전역 변수 생성, this 바인딩 오류 등을 런타임 에러로 잡아줌


// ════════════════════════════════════════════════════════════════════════════
//  전역 상태(State) 변수 — 앱 전반에서 공유되는 데이터
// ════════════════════════════════════════════════════════════════════════════

/**
 * 그리드 현재 행(Row) 수
 * 초깃값 10: 페이지 로드 시 10개 행으로 시작
 * addRow()/deleteRow() 가 이 값을 변경한 뒤 buildGrid()를 다시 호출
 */
let ROWS = 10;

/**
 * 그리드 현재 열(Column) 수
 * 초깃값 6: 페이지 로드 시 6개 열(A~F)로 시작
 */
let COLS = 6;

/**
 * 컬럼 필터 상태 객체
 * 형식: { 열인덱스(number): true/false }
 * 예) { 0: true, 1: true, 2: false } → A열·B열 포함, C열 제외
 *
 * true  = 출력에 포함
 * false = 출력에서 제외
 */
let colFilter = {};

/**
 * 가장 최근 generateOutput()으로 만든 출력 문자열
 * saveToFile()과 copyToClipboard()가 이 값을 사용
 * 출력이 아직 생성되지 않았으면 빈 문자열('')
 */
let lastOutput = '';


// ════════════════════════════════════════════════════════════════════════════
//  유틸리티 — 열 이름 변환
// ════════════════════════════════════════════════════════════════════════════

/**
 * 열 인덱스(0부터 시작)를 엑셀 스타일 열 이름으로 변환한다.
 *
 * 예시:
 *   0  → 'A'
 *   25 → 'Z'
 *   26 → 'AA'   (26개를 다 쓰면 두 자리로 넘어감)
 *   27 → 'AB'
 *
 * 알고리즘: 10진수→26진수 변환 (0-based → 1-based 보정 후 반복)
 *   - String.fromCharCode(65) → 'A', 66 → 'B', ...
 *
 * @param {number} idx - 0부터 시작하는 열 인덱스
 * @returns {string} 열 이름 (예: 'A', 'Z', 'AA', 'AB')
 */
function getColLabel(idx) {
  let label = '';
  let n = idx + 1;   // 1-based 로 변환 (A=1, B=2, ...)

  while (n > 0) {
    const rem = (n - 1) % 26;                      // 현재 자리의 나머지 (0~25)
    label = String.fromCharCode(65 + rem) + label; // 앞에 문자를 붙여나감
    n = Math.floor((n - 1) / 26);                  // 다음 자리로 올림
  }

  return label;
}


// ════════════════════════════════════════════════════════════════════════════
//  그리드 구성 — 테이블 생성 및 셀 이벤트 연결
// ════════════════════════════════════════════════════════════════════════════

/**
 * 그리드 테이블(#csv-grid)을 현재 ROWS × COLS 크기로 다시 빌드한다.
 *
 * 구조:
 *   <table id="csv-grid">
 *     <thead>
 *       <tr>  <th></th> <th>A</th> <th>B</th> ...  </tr>   ← 열 헤더
 *     </thead>
 *     <tbody>
 *       <tr>  <td class="row-num">1</td>  <td><input></td> ...  </tr>
 *       <tr>  <td class="row-num">2</td>  <td><input></td> ...  </tr>
 *       ...
 *     </tbody>
 *   </table>
 *
 * @param {string[][]|null} savedData
 *   보존할 기존 셀 데이터 (2D 배열).
 *   행 추가/삭제 시 기존 데이터를 먼저 saveGridData()로 저장한 뒤 여기에 전달.
 *   null 이면 빈 그리드로 생성.
 */
function buildGrid(savedData = null) {
  const table = document.getElementById('csv-grid');
  table.innerHTML = '';   // 기존 테이블 내용 전부 지우기

  // ── ① 헤더 행 생성 (<thead>) ─────────────────────────────────────────────
  const thead = table.createTHead();   // <thead> 요소 생성 및 table에 추가
  const hrow  = thead.insertRow();     // <tr> 요소 생성 및 thead에 추가

  // 왼쪽 맨 앞 코너 셀: 행번호 열과 열헤더 행이 교차하는 빈 칸
  const corner = document.createElement('th');
  corner.textContent = '';
  hrow.appendChild(corner);

  // 열 헤더 A, B, C, ... 생성
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement('th');
    th.textContent = getColLabel(c);   // 0→'A', 1→'B', ...
    hrow.appendChild(th);
  }

  // ── ② 데이터 행 생성 (<tbody>) ───────────────────────────────────────────
  const tbody = table.createTBody();  // <tbody> 요소 생성

  for (let r = 0; r < ROWS; r++) {
    const tr = tbody.insertRow();   // 새 <tr> 추가

    // 행 번호 셀 (1부터 시작, 파란 헤더 스타일)
    const numTd = document.createElement('td');
    numTd.className  = 'row-num';
    numTd.textContent = r + 1;   // 화면에 보이는 번호는 1부터
    tr.appendChild(numTd);

    // 데이터 입력 셀: 열 수만큼 반복
    for (let c = 0; c < COLS; c++) {
      const td = document.createElement('td');
      td.className = 'data-cell';

      // 실제 입력을 받는 <input type="text">
      const input = document.createElement('input');
      input.type = 'text';

      // data-row, data-col 속성: 어떤 행/열인지 표시
      // getCell(r, c) 가 이 속성으로 셀을 조회함
      input.setAttribute('data-row', r);
      input.setAttribute('data-col', c);

      // 기존 데이터 복원 (행 추가/삭제 후 데이터 유지를 위해)
      if (savedData && savedData[r] && savedData[r][c] !== undefined) {
        input.value = savedData[r][c];
      }

      // 이벤트 리스너 등록
      input.addEventListener('keydown', handleCellKeydown); // 셀 이동 (Tab/Enter/방향키)
      input.addEventListener('paste',   handlePaste);       // 붙여넣기 (Ctrl+V)

      td.appendChild(input);
      tr.appendChild(td);
    }
  }

  // ── ③ 그리드 재빌드 완료 후 컬럼 필터도 업데이트 ─────────────────────────
  // 열 수가 바뀌었을 수 있으므로 반드시 호출
  refreshColFilter();
}


/**
 * 현재 그리드의 모든 셀 값을 2D 배열로 반환한다.
 * buildGrid() 를 호출하기 전에 데이터를 보존할 때 사용한다.
 *
 * 반환 형식:
 *   [ ['A1', 'B1', ...],   ← 1행
 *     ['A2', 'B2', ...],   ← 2행
 *     ... ]
 *
 * @returns {string[][]} 현재 그리드 데이터
 */
function saveGridData() {
  const data = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const input = getCell(r, c);
      row.push(input ? input.value : '');  // 셀이 없으면 빈 문자열
    }
    data.push(row);
  }

  return data;
}


/**
 * (r, c) 위치의 <input> 요소를 반환한다.
 *
 * 동작 원리:
 *   querySelector로 data-row, data-col 속성이 일치하는 input을 검색
 *   예) getCell(2, 1) → input[data-row="2"][data-col="1"] → 3행 B열 input
 *
 * @param {number} r - 행 인덱스 (0-based, 화면의 1행 = r:0)
 * @param {number} c - 열 인덱스 (0-based, A열 = c:0)
 * @returns {HTMLInputElement|null} 해당 위치의 input 요소 (없으면 null)
 */
function getCell(r, c) {
  return document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
}


// ════════════════════════════════════════════════════════════════════════════
//  키보드 셀 이동 — Tab / Enter / 방향키
// ════════════════════════════════════════════════════════════════════════════

/**
 * 셀(input) 안에서 특수 키를 눌렀을 때 호출되는 이벤트 핸들러.
 * 다음 셀로 포커스를 이동시킨다.
 *
 * 이동 규칙:
 *   Tab         → 오른쪽 셀. 열 끝이면 다음 행 첫 번째 셀
 *   Shift + Tab → 왼쪽 셀.  열 처음이면 이전 행 마지막 셀
 *   Enter       → 아래쪽 셀 (마지막 행이면 이동 없음)
 *   ArrowDown   → 아래쪽 셀
 *   ArrowUp     → 위쪽 셀
 *   ArrowRight  → (커서가 맨 오른쪽일 때만) 오른쪽 셀
 *   ArrowLeft   → (커서가 맨 왼쪽일 때만) 왼쪽 셀
 *
 * @this {HTMLInputElement} 이벤트가 발생한 input 요소
 * @param {KeyboardEvent} e - 키보드 이벤트 객체
 */
function handleCellKeydown(e) {
  // 현재 셀의 행/열 위치 읽기
  const r = parseInt(this.getAttribute('data-row'));
  const c = parseInt(this.getAttribute('data-col'));

  // 이동할 목표 행/열 (기본값: 현재 위치 유지)
  let nr = r, nc = c;

  if (e.key === 'Tab') {
    e.preventDefault();  // 브라우저 기본 Tab 동작(포커스 이동) 차단
    if (e.shiftKey) {
      // Shift+Tab: 왼쪽으로
      if (nc > 0)       { nc--; }               // 왼쪽 셀로
      else if (nr > 0)  { nr--; nc = COLS - 1; } // 첫 열이면 위 행 마지막 열
    } else {
      // Tab: 오른쪽으로
      if (nc < COLS - 1)       { nc++; }          // 오른쪽 셀로
      else if (nr < ROWS - 1)  { nr++; nc = 0; }  // 마지막 열이면 다음 행 첫 열
    }

  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (nr < ROWS - 1) nr++;  // 아래 셀로 (마지막 행이면 이동 없음)

  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (nr < ROWS - 1) nr++;

  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (nr > 0) nr--;

  } else if (e.key === 'ArrowRight') {
    // 커서가 텍스트 맨 끝에 있을 때만 옆 셀로 이동
    // selectionStart: 현재 커서(캐럿) 위치, this.value.length: 텍스트 길이
    if (this.selectionStart === this.value.length && nc < COLS - 1) nc++;
    else return;  // 텍스트 중간이면 기본 동작(텍스트 내 이동) 유지

  } else if (e.key === 'ArrowLeft') {
    if (this.selectionStart === 0 && nc > 0) nc--;
    else return;

  } else {
    return;  // 위에서 처리되지 않은 키는 기본 동작 유지
  }

  // 목표 셀에 포커스 이동
  const target = getCell(nr, nc);
  if (target) target.focus();
}


// ════════════════════════════════════════════════════════════════════════════
//  붙여넣기 (Ctrl+V) — 클립보드 파싱 및 그리드 채우기
// ════════════════════════════════════════════════════════════════════════════

/**
 * 셀에서 paste 이벤트가 발생했을 때 호출되는 핸들러.
 *
 * 동작 순서:
 *   1. 클립보드에서 텍스트 가져오기 (ClipboardEvent.clipboardData)
 *   2. parseClipboard()로 텍스트를 2D 배열로 변환
 *   3. 현재 셀 위치(startR, startC)에서 시작해 그리드 채우기
 *   4. 데이터가 그리드 범위를 넘으면 ROWS/COLS 확장 후 buildGrid() 재호출
 *
 * @this {HTMLInputElement} 붙여넣기가 발생한 input 요소
 * @param {ClipboardEvent} e
 */
function handlePaste(e) {
  e.preventDefault();  // 브라우저 기본 붙여넣기(텍스트를 input에 삽입) 차단

  // 클립보드 텍스트 추출
  const text = e.clipboardData.getData('text/plain');
  if (!text.trim()) return;  // 공백만 있으면 무시

  // 붙여넣기 시작 위치 (포커스된 셀)
  const startR = parseInt(this.getAttribute('data-row'));
  const startC = parseInt(this.getAttribute('data-col'));

  // 텍스트 → 2D 배열 변환 (구분자 자동 감지)
  const rows = parseClipboard(text);
  if (!rows || rows.length === 0) return;

  // 필요한 행/열 수 계산
  const needR = startR + rows.length;                     // 필요한 총 행 수
  const needC = startC + Math.max(...rows.map(r => r.length)); // 필요한 총 열 수

  // 현재 그리드보다 크면 확장 후 재빌드
  if (needR > ROWS || needC > COLS) {
    const saved = saveGridData();        // 기존 데이터 백업
    ROWS = Math.max(needR, ROWS);
    COLS = Math.max(needC, COLS);
    buildGrid(saved);                    // 백업 데이터 포함해 재빌드
  }

  // 2D 배열의 각 값을 해당 셀에 입력
  rows.forEach((row, dr) => {           // dr: 시작 행으로부터의 오프셋
    row.forEach((val, dc) => {          // dc: 시작 열로부터의 오프셋
      const cell = getCell(startR + dr, startC + dc);
      if (cell) cell.value = val;
    });
  });
}


/**
 * 클립보드 텍스트를 2D 배열로 파싱한다.
 *
 * 구분자 자동 감지 순서: 탭(\t) → 쉼표(,) → 세미콜론(;)
 * 각 구분자로 나눠봐서 2열 이상이 나오면 그 구분자를 채택한다.
 * 모두 실패하면 줄 단위 단일 열 배열로 반환.
 *
 * 예시:
 *   "a\tb\tc\n1\t2\t3" → [['a','b','c'], ['1','2','3']]  (탭 감지)
 *   "a,b,c\n1,2,3"     → [['a','b','c'], ['1','2','3']]  (쉼표 감지)
 *
 * @param {string} text - 클립보드 원문 텍스트
 * @returns {string[][]} 파싱된 2D 배열
 */
function parseClipboard(text) {
  // 줄 분리: \r\n (Windows) 또는 \n (Unix/Mac) 모두 처리
  const lines = text.split(/\r?\n/);

  // 마지막 줄이 빈 줄이면 제거 (엑셀 복사 시 끝에 빈 줄이 붙는 경우 처리)
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  // 구분자 우선순위 순서대로 시도
  for (const delim of ['\t', ',', ';']) {
    const rows = lines.map(line => line.split(delim));
    const isMultiCol = rows.some(row => row.length > 1); // 2열 이상이면 채택
    if (isMultiCol) return rows;
  }

  // 구분자 감지 실패: 각 줄을 1열짜리 행으로 처리
  return lines.map(line => [line]);
}


// ════════════════════════════════════════════════════════════════════════════
//  행/열 추가·삭제 — 그리드 크기 동적 조정
// ════════════════════════════════════════════════════════════════════════════

/**
 * 그리드 아래에 빈 행 1개 추가.
 * 기존 데이터 보존 패턴: saveGridData() → ROWS 증가 → buildGrid(saved)
 */
function addRow() {
  const saved = saveGridData();  // 현재 데이터 백업
  ROWS++;                        // 행 수 1 증가
  buildGrid(saved);              // 백업 데이터 포함해 재빌드
}

/**
 * 마지막 행 삭제.
 * 조건:
 *   - 최소 1행은 유지 (ROWS <= 1 이면 무시)
 *   - 마지막 행에 데이터가 있으면 confirm 대화상자로 확인
 */
function deleteRow() {
  if (ROWS <= 1) return;  // 1행 이하면 삭제 불가

  // 마지막 행에 데이터가 있는지 확인
  const lastRowHasData = Array.from({ length: COLS }, (_, c) => getCell(ROWS - 1, c))
    .some(cell => cell && cell.value.trim() !== '');

  // 데이터가 있으면 사용자에게 확인
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
 * 조건:
 *   - 최소 1열은 유지 (COLS <= 1 이면 무시)
 *   - 마지막 열에 데이터가 있으면 confirm 확인
 */
function deleteCol() {
  if (COLS <= 1) return;

  // 마지막 열에 데이터가 있는지 확인
  const lastColHasData = Array.from({ length: ROWS }, (_, r) => getCell(r, COLS - 1))
    .some(cell => cell && cell.value.trim() !== '');

  const colName = getColLabel(COLS - 1);  // 삭제될 열 이름 (예: 'F')
  if (lastColHasData && !confirm(`'${colName}'열에 데이터가 있습니다. 삭제하시겠습니까?`)) return;

  const saved = saveGridData();
  COLS--;
  buildGrid(saved);
}

/**
 * 그리드 초기화 — 모든 셀 값을 빈 문자열로 만든다.
 * confirm 대화상자로 실수 방지.
 * (ROWS/COLS는 유지, 셀 데이터만 지움)
 */
function confirmClear() {
  if (!confirm('그리드의 모든 데이터를 초기화하시겠습니까?')) return;

  // querySelectorAll: 조건에 맞는 모든 요소를 NodeList로 반환
  // forEach로 각 input의 value를 빈 문자열로 설정
  document.querySelectorAll('#csv-grid input').forEach(input => {
    input.value = '';
  });
}


// ════════════════════════════════════════════════════════════════════════════
//  컬럼 필터 — 출력에 포함할 열 선택
// ════════════════════════════════════════════════════════════════════════════

/**
 * 현재 열 수(COLS)에 맞게 컬럼 필터 체크박스를 다시 그린다.
 *
 * 동작:
 *   1. 범위를 벗어난 열의 colFilter 상태 삭제
 *   2. 새로 추가된 열은 colFilter[c] = true (기본 선택)
 *   3. 기존 열의 선택 상태(true/false)는 그대로 유지
 *   4. 각 열에 대해 pill 형태의 label+checkbox 요소 생성
 *
 * 이 함수는 buildGrid() 마지막에도 자동 호출된다.
 */
function refreshColFilter() {
  const container = document.getElementById('col-filter-checkboxes');
  container.innerHTML = '';  // 기존 체크박스 전부 제거

  // COLS 범위를 벗어난 열의 상태 정리 (열 삭제 시 잔여 데이터 제거)
  Object.keys(colFilter).forEach(k => {
    if (parseInt(k) >= COLS) delete colFilter[k];
  });

  // 열마다 체크박스 pill 생성
  for (let c = 0; c < COLS; c++) {
    // 새로 추가된 열은 기본값 true (선택 상태)
    if (!(c in colFilter)) colFilter[c] = true;

    // <label class="col-checkbox-label [unchecked]">
    //   <input type="checkbox"> A
    // </label>
    const label = document.createElement('label');
    label.className = 'col-checkbox-label' + (colFilter[c] ? '' : ' unchecked');

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = colFilter[c];

    // 체크 상태 변경 시 colFilter 업데이트 + .unchecked 클래스 토글
    cb.addEventListener('change', () => {
      colFilter[c] = cb.checked;
      label.classList.toggle('unchecked', !cb.checked);
      // toggle(className, force): force=true면 추가, false면 제거
    });

    label.appendChild(cb);
    label.appendChild(document.createTextNode(getColLabel(c)));  // 'A', 'B', ...
    container.appendChild(label);
  }
}

/**
 * 모든 열 체크박스를 선택(true) 상태로 설정하고 UI를 다시 그린다.
 */
function selectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = true;
  refreshColFilter();
}

/**
 * 모든 열 체크박스를 해제(false) 상태로 설정하고 UI를 다시 그린다.
 */
function deselectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = false;
  refreshColFilter();
}


// ════════════════════════════════════════════════════════════════════════════
//  CSV 파일 불러오기 — FileReader API
// ════════════════════════════════════════════════════════════════════════════

/**
 * 숨겨진 <input type="file"> 요소를 프로그래밍적으로 클릭한다.
 * "CSV 불러오기" 버튼 onclick → 이 함수 호출 → 파일 선택 대화상자 열림
 */
function triggerFileLoad() {
  document.getElementById('csv-file-input').click();
}

/**
 * 파일이 선택됐을 때 호출되는 핸들러 (input[type=file] onchange).
 *
 * FileReader API 동작 순서:
 *   1. new FileReader()              객체 생성
 *   2. reader.onload = (ev) => {...} 읽기 완료 시 실행할 콜백 등록
 *   3. reader.readAsText(file)       비동기로 파일 읽기 시작
 *   4. 읽기 완료 → onload 콜백 실행 → ev.target.result 에 텍스트 있음
 *
 * @param {Event} e - input[type=file] 의 change 이벤트
 */
function loadCSVFile(e) {
  const file = e.target.files[0];  // 선택된 첫 번째 파일 객체
  if (!file) return;               // 파일 선택 취소 시 무시

  const reader = new FileReader();

  // 파일 읽기 완료 콜백 (비동기: 읽기가 끝나면 자동 호출)
  reader.onload = (ev) => {
    const text = ev.target.result;  // 파일 전체 텍스트

    // 줄 단위로 나누고 각 줄을 쉼표로 분리 → 2D 배열
    const rows = text
      .split(/\r?\n/)              // 줄 분리
      .filter(line => line.trim()) // 빈 줄 제거
      .map(line => line.split(',')); // 쉼표로 열 분리

    // 필요한 그리드 크기 계산
    const newRows = Math.max(rows.length, ROWS);
    const newCols = Math.max(Math.max(...rows.map(r => r.length)), COLS);

    // 그리드 크기 업데이트 및 재빌드
    ROWS = newRows;
    COLS = newCols;
    buildGrid();  // savedData 없이 빌드 (이후 루프에서 값 채움)

    // 각 셀에 파일 데이터 입력
    rows.forEach((row, r) => {
      row.forEach((val, c) => {
        const cell = getCell(r, c);
        if (cell) {
          // CSV 따옴표 제거: "abc" → abc
          // 정규식 ^"|"$ : 문자열 맨 앞 또는 맨 뒤의 큰따옴표
          cell.value = val.replace(/^"|"$/g, '');
        }
      });
    });

    showToast(`✅ '${file.name}' 불러오기 완료`);
  };

  // 파일 읽기 오류 콜백
  reader.onerror = () => showToast('❌ 파일을 읽을 수 없습니다.');

  // 파일 읽기 시작 (UTF-8 인코딩)
  reader.readAsText(file, 'UTF-8');

  // 같은 파일을 다시 선택할 수 있도록 value 초기화
  // (value를 초기화하지 않으면 onchange가 두 번째 선택 시 발생하지 않음)
  e.target.value = '';
}


// ════════════════════════════════════════════════════════════════════════════
//  출력 생성 — 접두 문자열 + CSV 데이터 조합
// ════════════════════════════════════════════════════════════════════════════

/**
 * 구분자 라디오 버튼에서 현재 선택된 값을 반환한다.
 * name="sep" 인 radio 중 checked 상태인 것의 value를 읽음.
 *
 * @returns {string} ',' | '\t' | ';'
 */
function getSelectedSep() {
  return document.querySelector('input[name="sep"]:checked').value;
}

/**
 * 그리드에서 selectedCols 열만 추출해 2D 배열로 반환한다.
 * 완전히 비어있는 행은 결과에서 제외한다.
 *
 * @param {number[]} selectedCols - 포함할 열 인덱스 배열 (예: [0, 2, 3])
 * @returns {string[][]} 필터링된 데이터 2D 배열
 */
function getGridData(selectedCols) {
  const result = [];

  for (let r = 0; r < ROWS; r++) {
    // 선택된 열만 추출
    const row = selectedCols.map(c => {
      const cell = getCell(r, c);
      return cell ? cell.value : '';
    });

    // 모든 셀이 비어있는 행은 제외
    // Array.some(): 하나라도 조건을 만족하면 true 반환
    if (row.some(v => v.trim() !== '')) {
      result.push(row);
    }
  }

  return result;
}

/**
 * 2D 배열을 CSV 형식의 문자열로 변환한다.
 *
 * RFC 4180 규칙 적용:
 *   - 값에 구분자, 큰따옴표, 줄바꿈이 포함되면 큰따옴표로 감쌈
 *   - 값 안의 큰따옴표는 ""로 이스케이프
 *
 * 예시 (구분자=','):
 *   [['a','b,c'],['d','e"f']] → 'a,"b,c"\nd,"e""f"'
 *
 * @param {string[][]} data - 변환할 2D 배열
 * @param {string} sep - 구분자 문자
 * @returns {string} CSV 형식 문자열
 */
function toCSVString(data, sep) {
  return data
    .map(row =>
      row.map(v => {
        // 구분자, 큰따옴표, 줄바꿈이 포함된 값은 따옴표로 감쌈
        if (v.includes(sep) || v.includes('"') || v.includes('\n')) {
          return '"' + v.replace(/"/g, '""') + '"';  // 내부 " → ""
        }
        return v;
      }).join(sep)  // 열을 구분자로 연결
    )
    .join('\n');    // 행을 줄바꿈으로 연결
}

/**
 * 접두 문자열(prefix)과 CSV 데이터를 합쳐 최종 출력을 생성한다.
 * 결과는 output-preview에 표시되고 lastOutput에 저장된다.
 *
 * 조합 규칙:
 *   선택 열 없음   → 경고 토스트 (출력 생성 불가)
 *   둘 다 빔       → 경고 토스트 (출력 생성 불가)
 *   접두만 있음    → prefix 만 출력
 *   CSV만 있음     → CSV 만 출력
 *   둘 다 있음     → prefix + '\n' + CSV
 */
function generateOutput() {
  // ① 선택된 열 인덱스 수집
  // Object.entries(): { 0:true, 1:false, 2:true } → [['0',true],['1',false],['2',true]]
  // filter: value가 true인 것만
  // map: key(string)를 number로 변환
  const selectedCols = Object.entries(colFilter)
    .filter(([, v]) => v)
    .map(([k]) => parseInt(k));

  if (selectedCols.length === 0) {
    showToast('⚠️ 출력할 열을 하나 이상 선택해주세요.');
    return;
  }

  // ② 접두 문자열과 CSV 데이터 수집
  const prefix  = document.getElementById('prefix-text').value.trimEnd();  // 우측 공백 제거
  const sep     = getSelectedSep();
  const gridData = getGridData(selectedCols);
  const csvStr  = gridData.length > 0 ? toCSVString(gridData, sep) : '';

  // ③ 둘 다 비어있으면 경고
  if (!prefix.trim() && !csvStr) {
    showToast('⚠️ 그리드와 접두 문자열이 모두 비어있습니다.');
    return;
  }

  // ④ 조합
  if (prefix.trim() && csvStr) {
    lastOutput = prefix + '\n' + csvStr;   // 접두 + 줄바꿈 + CSV
  } else if (prefix.trim()) {
    lastOutput = prefix;                   // 접두만
  } else {
    lastOutput = csvStr;                   // CSV만
  }

  // ⑤ 미리보기 갱신 및 알림
  updatePreview(lastOutput);
  showToast('✅ 출력이 생성되었습니다.');
}

/**
 * 출력 미리보기 영역(<pre id="output-preview">)의 텍스트를 갱신한다.
 *
 * <pre> 태그: 텍스트를 공백·줄바꿈 그대로 표시 (preformatted text)
 * textContent에 값을 넣으면 HTML 태그 없이 순수 텍스트로 표시됨
 *
 * @param {string} text - 표시할 문자열
 */
function updatePreview(text) {
  const pre = document.getElementById('output-preview');
  pre.textContent = text;  // innerHTML 대신 textContent → XSS 방지
}


// ════════════════════════════════════════════════════════════════════════════
//  파일 저장 — Blob + <a download>
// ════════════════════════════════════════════════════════════════════════════

/**
 * lastOutput을 UTF-8 CSV 파일로 다운로드한다.
 *
 * 브라우저에서 파일 저장 구현 방법:
 *   1. new Blob([내용], {type: MIME타입})  → 메모리에 파일 내용 생성
 *   2. URL.createObjectURL(blob)           → blob을 가리키는 임시 URL 생성
 *   3. <a href=URL download=파일명>.click() → 다운로드 트리거
 *   4. URL.revokeObjectURL(url)            → 임시 URL 메모리 해제
 */
function saveToFile() {
  if (!lastOutput) {
    showToast('⚠️ 먼저 출력을 생성해주세요.');
    return;
  }

  // Blob: Binary Large Object — 파일 내용을 메모리에 담는 객체
  const blob = new Blob([lastOutput], { type: 'text/csv;charset=utf-8;' });

  // 임시 URL 생성 (blob:http://... 형태의 내부 URL)
  const url = URL.createObjectURL(blob);

  // 임시 <a> 태그 생성 → 클릭 → 다운로드 시작
  const a = document.createElement('a');
  a.href     = url;
  a.download = 'output.csv';       // 다운로드될 파일 이름
  document.body.appendChild(a);   // DOM에 추가해야 클릭이 동작
  a.click();                       // 프로그래밍적으로 클릭
  document.body.removeChild(a);   // 즉시 제거
  URL.revokeObjectURL(url);        // 임시 URL 해제 (메모리 누수 방지)

  showToast('✅ 파일이 저장되었습니다.');
}


// ════════════════════════════════════════════════════════════════════════════
//  클립보드 복사 — Clipboard API
// ════════════════════════════════════════════════════════════════════════════

/**
 * lastOutput을 클립보드에 복사한다.
 *
 * navigator.clipboard.writeText():
 *   - 현대 브라우저 Clipboard API (Promise 기반 비동기)
 *   - HTTPS 또는 localhost 에서만 사용 가능 (보안 정책)
 *
 * 실패 시 fallback:
 *   - document.execCommand('copy'): 구형 방식 (deprecated 이지만 로컬 파일에서 동작)
 *   - 임시 textarea 에 텍스트를 넣고 select() → execCommand('copy')
 */
function copyToClipboard() {
  if (!lastOutput) {
    showToast('⚠️ 먼저 출력을 생성해주세요.');
    return;
  }

  navigator.clipboard.writeText(lastOutput)
    .then(() => {
      showToast('✅ 클립보드에 복사되었습니다.');
    })
    .catch(() => {
      // Clipboard API 실패 시 구형 방식으로 재시도
      const ta = document.createElement('textarea');
      ta.value = lastOutput;
      ta.style.position = 'fixed';    // 스크롤 방지
      ta.style.opacity  = '0';        // 화면에 안 보이게
      document.body.appendChild(ta);
      ta.select();                     // 텍스트 전체 선택
      document.execCommand('copy');    // 복사 명령 실행
      document.body.removeChild(ta);
      showToast('✅ 클립보드에 복사되었습니다.');
    });
}


// ════════════════════════════════════════════════════════════════════════════
//  토스트 알림 — 화면 하단 팝업 메시지
// ════════════════════════════════════════════════════════════════════════════

/** 토스트 자동 닫기 타이머 ID (clearTimeout에 사용) */
let toastTimer = null;

/**
 * 화면 하단에 잠깐 나타나는 알림 메시지(Toast)를 표시한다.
 *
 * 동작 순서:
 *   1. #toast 요소에 메시지 텍스트 설정
 *   2. .show 클래스 추가 → CSS transition으로 페이드인
 *   3. duration ms 후 .show 제거 → 페이드아웃
 *
 * 이미 표시 중이면 타이머를 초기화해 새 메시지로 갱신한다.
 *
 * @param {string} msg - 표시할 메시지 (이모지 포함 가능)
 * @param {number} [duration=2200] - 표시 유지 시간 (밀리초)
 */
function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  // 이전 타이머 취소 후 새 타이머 설정
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}


// ════════════════════════════════════════════════════════════════════════════
//  전역 단축키 — Ctrl + Enter
// ════════════════════════════════════════════════════════════════════════════

/**
 * 페이지 어디서든 Ctrl+Enter 를 누르면 출력을 생성한다.
 *
 * document.addEventListener('keydown', ...):
 *   - document: 페이지 전체에서 키 이벤트를 감지
 *   - e.ctrlKey: Ctrl 키가 눌려있으면 true
 *   - e.key === 'Enter': Enter 키
 */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();  // 브라우저 기본 동작 차단 (폼 제출 등)
    generateOutput();
  }
});


// ════════════════════════════════════════════════════════════════════════════
//  Sample Code — 변수 치환 테스트 플레이그라운드
// ════════════════════════════════════════════════════════════════════════════
/*
  개념:
    1. templateVars 배열에 변수 목록 저장
    2. 각 변수는 { name, value, find, replace, useRegex } 구조
    3. 접두 문자열의 {{name}} → applyVarTransform(v) 결과로 치환
    4. 미리보기에서 실시간 확인 → "접두 문자열에 적용" 버튼으로 반영

  변환 흐름:
    원본 값 (value)
      → Find/Replace 적용 (문자열 치환 또는 정규식 치환)
      → 변환된 값
      → 접두 문자열의 {{name}} 자리에 삽입
      → 미리보기 출력
*/

// ── 상태: 변수 목록 ─────────────────────────────────────────────────────────

/**
 * 템플릿 변수 배열
 * 각 항목의 구조:
 *   name      {string} 변수 이름 — 접두 문자열에서 {{name}} 으로 참조
 *   value     {string} 원본 값  — Find/Replace 변환 전 값
 *   find      {string} 검색 패턴 — useRegex=true면 정규식, false면 일반 문자열
 *   replace   {string} 치환 문자열 — 정규식 그룹 참조 $1, $2 등 사용 가능
 *   useRegex  {boolean} 정규식 모드 여부
 */
let templateVars = [];

/**
 * 샘플 초기값 목록 — 파일명·좌표 등 실제 사용 예시
 *
 * 사용 방법 (접두 문자열 예시):
 *   file: {{filename}}
 *   coord: ({{x_coord}}, {{y_coord}})
 *   label: {{label}}
 *
 * 변환 예시:
 *   filename : "image_001.jpg" → 정규식 \.jpg$ → .png → "image_001.png"
 *   x_coord  : "37.123456789" → 정규식 소수점 4자리만 → "37.1234"
 *   y_coord  : "127.987654321" → 정규식 소수점 4자리만 → "127.9876"
 *   label    : "car_001"      → 변환 없이 그대로 사용
 */
const SAMPLE_VARS = [
  {
    name: 'filename',
    value: 'image_001.jpg',
    find: '\\.jpg$',        // 정규식: 문자열 끝의 .jpg
    replace: '.png',        // .png 로 바꿈
    useRegex: true,
  },
  {
    name: 'x_coord',
    value: '37.123456789',
    find: '(\\d+\\.\\d{4})\\d+',  // 소수점 이하 4자리까지만 남기기
    replace: '$1',                 // 첫 번째 그룹($1)만 사용
    useRegex: true,
  },
  {
    name: 'y_coord',
    value: '127.987654321',
    find: '(\\d+\\.\\d{4})\\d+',
    replace: '$1',
    useRegex: true,
  },
  {
    name: 'label',
    value: 'car_001',
    find: '',     // 변환 없음
    replace: '',
    useRegex: false,
  },
];


// ── 초기화 ──────────────────────────────────────────────────────────────────

/**
 * SAMPLE_VARS 를 깊은 복사해 templateVars 를 초기화하고 UI를 다시 그린다.
 * spread 문법 {...v} 로 각 객체를 복사 → 원본 SAMPLE_VARS 가 변경되지 않도록 보호
 */
function initTemplateVars() {
  templateVars = SAMPLE_VARS.map(v => ({ ...v }));  // 깊은 복사
  renderTemplateVars();
}

/** 빈 변수 1개를 templateVars 에 추가하고 UI를 다시 그린다. */
function addTemplateVar() {
  templateVars.push({
    name: `var${templateVars.length + 1}`,
    value: '',
    find: '',
    replace: '',
    useRegex: false,
  });
  renderTemplateVars();
}

/**
 * 지정 인덱스의 변수를 삭제하고 UI를 다시 그린다.
 * Array.splice(시작인덱스, 삭제개수): 배열을 직접 수정
 * @param {number} idx - 삭제할 변수의 인덱스
 */
function removeTemplateVar(idx) {
  templateVars.splice(idx, 1);
  renderTemplateVars();
}

/** 샘플 기본값으로 초기화 (confirm 없이 즉시 실행) */
function resetTemplateVars() {
  initTemplateVars();
  showToast('✅ 샘플 변수로 초기화했습니다.');
}

/** 모든 변수 삭제 */
function clearTemplateVars() {
  if (!confirm('모든 변수를 삭제하시겠습니까?')) return;
  templateVars = [];
  renderTemplateVars();
}


// ── 변환 로직 ───────────────────────────────────────────────────────────────

/**
 * 변수 1개에 Find/Replace 변환을 적용하고 결과 문자열을 반환한다.
 *
 * useRegex = false (일반 문자열 치환):
 *   String.split(find).join(replace) 패턴 사용
 *   → replaceAll 과 동일하지만 구형 브라우저 호환성 확보
 *
 * useRegex = true (정규식 치환):
 *   new RegExp(find, 'g') 로 글로벌 정규식 생성
 *   String.replace(regex, replace) 실행
 *   → replace 안에 $1, $2 등 캡처 그룹 참조 사용 가능
 *
 * 정규식 오류 처리:
 *   잘못된 패턴(예: "[unclosed") 이면 SyntaxError 발생
 *   catch 로 잡아 원본 값 + "⚠️ 오류" 문자열 반환 (앱 중단 방지)
 *
 * @param {{ name, value, find, replace, useRegex }} v - 변수 객체
 * @returns {string} 변환 결과 문자열
 */
function applyVarTransform(v) {
  let val = v.value;

  // find 패턴이 없으면 변환 없이 원본 반환
  if (!v.find) return val;

  try {
    if (v.useRegex) {
      // 정규식 모드: 'g' 플래그 = 전체 치환 (없으면 첫 번째만 치환)
      const regex = new RegExp(v.find, 'g');
      val = val.replace(regex, v.replace);
    } else {
      // 일반 문자열 모드: 모든 출현 치환
      val = val.split(v.find).join(v.replace);
    }
  } catch (e) {
    // 잘못된 정규식 패턴 → 오류 표시 (앱 동작은 계속)
    return val + ' ⚠️ 정규식 오류';
  }

  return val;
}

/**
 * 주어진 텍스트에서 {{변수명}} 을 모두 변환된 값으로 치환한다.
 *
 * 동작:
 *   templateVars 를 순서대로 순회하며
 *   text 안의 {{v.name}} 을 applyVarTransform(v) 결과로 교체
 *
 * 주의: 변수 이름이 빈 문자열이면 건너뜀 ({{}} 치환 방지)
 *
 * @param {string} text - 치환할 원본 텍스트 (접두 문자열 등)
 * @returns {string} 치환 완료 텍스트
 */
function applyTemplateToText(text) {
  let result = text;

  templateVars.forEach(v => {
    if (!v.name.trim()) return;  // 이름 없는 변수는 건너뜀

    const transformed = applyVarTransform(v);
    // split+join 패턴 = replaceAll 과 동일 (전체 치환)
    result = result.split(`{{${v.name}}}`).join(transformed);
  });

  return result;
}


// ── 미리보기 갱신 ───────────────────────────────────────────────────────────

/**
 * 접두 문자열에 변수 치환을 적용한 결과를 미리보기에 표시한다.
 * 미치환 {{변수명}} (정의되지 않은 변수) 은 innerHTML 로 오렌지 강조 처리.
 *
 * 이 함수는 다음 상황에서 자동 호출된다:
 *   - 접두 문자열 textarea 에 입력 시 (input 이벤트)
 *   - renderTemplateVars() 호출 후 (변수 목록 변경 시)
 *   - 변수 입력 필드 값 변경 시
 */
function updateTemplatePreview() {
  const prefix  = document.getElementById('prefix-text').value;
  const preview = document.getElementById('template-preview');

  if (!prefix.trim()) {
    // 접두 문자열이 비어있으면 안내 문구 표시
    preview.innerHTML = '<span class="placeholder">접두 문자열에 {{변수명}}을 입력하면 여기서 치환 결과를 미리볼 수 있습니다.</span>';
    return;
  }

  // 1단계: 정의된 변수 치환
  const substituted = applyTemplateToText(prefix);

  // 2단계: 미치환 {{...}} 강조 (정의되지 않은 변수 이름)
  //   textContent 대신 innerHTML 사용 + HTML 이스케이프 필요
  const escaped = substituted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 남아있는 {{...}} 를 오렌지 <span> 으로 감쌈
  const highlighted = escaped.replace(
    /\{\{([^}]+)\}\}/g,
    '<span class="unresolved-var">{{$1}}</span>'
  );

  preview.innerHTML = highlighted;
}

/**
 * 미리보기 결과(치환 완료 텍스트)를 실제 접두 문자열 textarea 에 덮어쓴다.
 * 이후 generateOutput() 호출 시 변환된 값이 출력에 반영된다.
 */
function applyToPrefix() {
  const prefix = document.getElementById('prefix-text').value;
  if (!prefix.trim()) {
    showToast('⚠️ 접두 문자열이 비어있습니다.');
    return;
  }

  const result = applyTemplateToText(prefix);
  document.getElementById('prefix-text').value = result;
  updateTemplatePreview();
  showToast('✅ 치환 결과가 접두 문자열에 적용되었습니다.');
}

/**
 * 접두 문자열 textarea 의 현재 커서 위치에 {{변수명}} 을 삽입한다.
 *
 * 커서 위치 처리:
 *   selectionStart  : 현재 커서(또는 선택 시작) 위치
 *   selectionEnd    : 선택 끝 위치 (커서만 있을 때는 selectionStart 와 동일)
 *   선택 영역이 있으면 그 영역을 {{name}} 으로 대체
 *
 * @param {string} name - 삽입할 변수 이름
 */
function insertVarIntoPrefix(name) {
  const ta  = document.getElementById('prefix-text');
  const pos = ta.selectionStart;                    // 커서 위치
  const end = ta.selectionEnd;
  const placeholder = `{{${name}}}`;

  // 커서 앞부분 + 플레이스홀더 + 커서 뒷부분
  ta.value = ta.value.substring(0, pos) + placeholder + ta.value.substring(end);

  // 삽입 후 커서를 플레이스홀더 끝으로 이동
  const newPos = pos + placeholder.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();

  updateTemplatePreview();
  showToast(`✅ {{${name}}} 을 접두 문자열에 삽입했습니다.`);
}


// ── UI 렌더링 ────────────────────────────────────────────────────────────────

/**
 * templateVars 배열을 기반으로 변수 테이블 행들을 다시 그린다.
 * 변수 추가/삭제/초기화 시 항상 이 함수를 호출한다.
 *
 * 각 행 구조 (CSS Grid 7열):
 *   [변수명 input] [값 input] [Find input] [Regex☑] [Replace input] [▶접두] [✕]
 */
function renderTemplateVars() {
  const container = document.getElementById('template-var-rows');
  container.innerHTML = '';  // 기존 행 전부 제거

  templateVars.forEach((v, idx) => {
    const row = document.createElement('div');
    row.className = 'tvar-row tvar-data-row';

    // ① 변수명 input (모노스페이스, 파란색)
    const nameInput = makeTvarInput(v.name, 'name-input', '변수명', val => {
      templateVars[idx].name = val;
      // 버튼 tooltip 업데이트
      insertBtn.title = `접두 문자열에 {{${val}}} 삽입`;
      updateTemplatePreview();
    });

    // ② 원본 값 input
    const valueInput = makeTvarInput(v.value, '', '원본 값', val => {
      templateVars[idx].value = val;
      updateTemplatePreview();
    });

    // ③ Find 패턴 input (모노스페이스, 오렌지색)
    const findInput = makeTvarInput(v.find, 'find-input', '패턴 (문자열 or 정규식)', val => {
      templateVars[idx].find = val;
      updateTemplatePreview();
    });

    // ④ Regex 체크박스 (정규식 모드 토글)
    const regexWrap = document.createElement('div');
    regexWrap.className = 'tvar-regex-wrap';

    const regexCb = document.createElement('input');
    regexCb.type    = 'checkbox';
    regexCb.checked = v.useRegex;
    regexCb.title   = '정규식 모드로 Find/Replace 실행';
    regexCb.addEventListener('change', () => {
      templateVars[idx].useRegex = regexCb.checked;
      updateTemplatePreview();
    });

    const regexLabel = document.createElement('span');
    regexLabel.textContent = 'Regex';

    regexWrap.append(regexCb, regexLabel);

    // ⑤ Replace input
    const replaceInput = makeTvarInput(v.replace, 'replace-input', '치환 값 ($1, $2 사용 가능)', val => {
      templateVars[idx].replace = val;
      updateTemplatePreview();
    });

    // ⑥ ▶접두 삽입 버튼: 접두 textarea 커서 위치에 {{name}} 삽입
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-mini btn-mini-insert';
    insertBtn.textContent = '▶접두';
    insertBtn.title = `접두 문자열에 {{${v.name}}} 삽입`;
    insertBtn.addEventListener('click', () => insertVarIntoPrefix(templateVars[idx].name));

    // ⑦ ✕ 삭제 버튼
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-mini btn-mini-danger';
    delBtn.textContent = '✕';
    delBtn.title = '이 변수 삭제';
    delBtn.addEventListener('click', () => removeTemplateVar(idx));

    row.append(nameInput, valueInput, findInput, regexWrap, replaceInput, insertBtn, delBtn);
    container.appendChild(row);
  });

  // 변수 목록 변경 후 미리보기 갱신
  updateTemplatePreview();
}

/**
 * 변수 테이블용 <input> 요소를 생성하는 헬퍼 함수.
 * 반복되는 input 생성 코드를 한 곳에서 관리.
 *
 * @param {string} value - 초기 값
 * @param {string} extraClass - 추가할 CSS 클래스 (예: 'name-input', 'find-input')
 * @param {string} placeholder - 플레이스홀더 텍스트
 * @param {function} onInput - 값 변경 시 호출할 콜백 (새 값을 인자로 받음)
 * @returns {HTMLInputElement}
 */
function makeTvarInput(value, extraClass, placeholder, onInput) {
  const input = document.createElement('input');
  input.type        = 'text';
  input.className   = `tvar-input${extraClass ? ' ' + extraClass : ''}`;
  input.value       = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}


// ── 패널 접기/펼치기 ─────────────────────────────────────────────────────────

/**
 * Sample Code 패널의 바디를 토글한다.
 * 버튼 텍스트를 ▲/▼ 로 전환해 현재 상태를 시각적으로 표시.
 *
 * display 속성 제어:
 *   'flex'  → 현재 열려있음 → 닫기 (none)
 *   기타    → 현재 닫혀있음 → 열기 (flex)
 */
function toggleSamplePanel() {
  const body    = document.getElementById('sample-body');
  const btn     = document.getElementById('sample-toggle-btn');
  const isOpen  = body.style.display !== 'none';

  body.style.display = isOpen ? 'none' : 'flex';
  btn.textContent    = isOpen ? '▼ 펼치기' : '▲ 접기';
}


// ════════════════════════════════════════════════════════════════════════════
//  초기화 — 페이지 로드 시 실행
// ════════════════════════════════════════════════════════════════════════════

/**
 * DOMContentLoaded 이벤트:
 *   HTML 파싱이 완료되어 DOM 트리가 준비됐을 때 발생.
 *   (이미지, 스타일시트 로드 완료는 기다리지 않음)
 *
 *   index.html의 <table id="csv-grid"> 가 비어있는 상태로 로드되므로,
 *   이 시점에서 buildGrid()를 호출해 초기 10×6 그리드를 채운다.
 */
document.addEventListener('DOMContentLoaded', () => {
  buildGrid();           // 기본 10행 × 6열 빈 그리드 생성
  initTemplateVars();    // 샘플 변수 목록 초기화 (파일명·좌표 예시)

  // 접두 문자열 변경 시 미리보기 자동 갱신
  // 'input' 이벤트: 키 입력, 붙여넣기, 잘라내기 등 모든 값 변경에 반응
  document.getElementById('prefix-text').addEventListener('input', updateTemplatePreview);
});
