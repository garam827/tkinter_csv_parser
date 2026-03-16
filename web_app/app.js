/**
 * app.js — CSV Prefix Tool 메인 로직
 *
 * 파이썬 버전과 기능 1:1 대응:
 *   CSVGrid        → buildGrid(), addRow/Col, deleteRow/Col, handlePaste
 *   CSVPrefixApp   → generateOutput(), saveToFile(), copyToClipboard()
 *   OutputPanel    → updatePreview()
 *   theme.py       → style.css
 *
 * 주요 Web API 사용:
 *   - ClipboardEvent (붙여넣기)
 *   - FileReader API (CSV 불러오기)
 *   - Blob + <a download> (파일 저장)
 *   - navigator.clipboard (클립보드 복사)
 */

'use strict';

// ════════════════════════════════════════════════════════════════════════════
//  상태(State) — 그리드 크기 및 컬럼 필터
// ════════════════════════════════════════════════════════════════════════════

/** 그리드 현재 행/열 수 */
let ROWS = 10;
let COLS = 6;

/**
 * 컬럼 필터 상태: { 열인덱스(number): true/false }
 * true = 출력에 포함, false = 출력에서 제외
 */
let colFilter = {};

/** 가장 최근 생성된 출력 문자열 (저장/복사에 사용) */
let lastOutput = '';


// ════════════════════════════════════════════════════════════════════════════
//  그리드 구성
// ════════════════════════════════════════════════════════════════════════════

/**
 * 열 인덱스 → 엑셀 스타일 열 이름 변환
 * 0→'A', 25→'Z', 26→'AA', 27→'AB' ...
 * @param {number} idx - 0부터 시작하는 열 인덱스
 * @returns {string} 열 이름 (예: 'A', 'B', 'AA')
 */
function getColLabel(idx) {
  let label = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/**
 * 그리드 테이블을 현재 ROWS × COLS 크기로 재빌드한다.
 * 기존 데이터를 보존하고 싶을 때는 savedData를 넘긴다.
 * @param {string[][]} [savedData] - 보존할 기존 셀 데이터 (2D 배열)
 */
function buildGrid(savedData = null) {
  const table = document.getElementById('csv-grid');
  table.innerHTML = '';   // 기존 내용 초기화

  // ── 헤더 행 (th 요소들) ──────────────────────────────────────────────
  const thead = table.createTHead();
  const hrow = thead.insertRow();

  // 맨 왼쪽 코너 셀 (행번호 + 열헤더 교차점)
  const corner = document.createElement('th');
  corner.textContent = '';
  hrow.appendChild(corner);

  // 열 헤더: A, B, C, ...
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement('th');
    th.textContent = getColLabel(c);
    hrow.appendChild(th);
  }

  // ── 데이터 행 (tr + td) ──────────────────────────────────────────────
  const tbody = table.createTBody();

  for (let r = 0; r < ROWS; r++) {
    const tr = tbody.insertRow();

    // 행 번호 셀 (1부터 시작)
    const numTd = document.createElement('td');
    numTd.className = 'row-num';
    numTd.textContent = r + 1;
    tr.appendChild(numTd);

    // 데이터 입력 셀 (input 요소)
    for (let c = 0; c < COLS; c++) {
      const td = document.createElement('td');
      td.className = 'data-cell';

      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-row', r);
      input.setAttribute('data-col', c);

      // 보존된 데이터 복원
      if (savedData && savedData[r] && savedData[r][c] !== undefined) {
        input.value = savedData[r][c];
      }

      // Tab/Enter/방향키 이동 바인딩
      input.addEventListener('keydown', handleCellKeydown);

      // Ctrl+V 붙여넣기 바인딩
      input.addEventListener('paste', handlePaste);

      td.appendChild(input);
      tr.appendChild(td);
    }
  }

  // 그리드 재빌드 후 컬럼 필터도 갱신
  refreshColFilter();
}

/**
 * 현재 모든 셀 데이터를 2D 배열로 반환한다. (그리드 재빌드 전 백업용)
 * @returns {string[][]}
 */
function saveGridData() {
  const data = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const input = getCell(r, c);
      row.push(input ? input.value : '');
    }
    data.push(row);
  }
  return data;
}

/**
 * (row, col) 위치의 input 요소를 반환한다.
 * @param {number} r - 행 인덱스 (0-based)
 * @param {number} c - 열 인덱스 (0-based)
 * @returns {HTMLInputElement|null}
 */
function getCell(r, c) {
  return document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
}


// ════════════════════════════════════════════════════════════════════════════
//  키보드 셀 이동
// ════════════════════════════════════════════════════════════════════════════

/**
 * 셀 안에서 Tab / Shift+Tab / Enter / 방향키 처리
 * 범위를 벗어나면 이동하지 않는다.
 * @param {KeyboardEvent} e
 */
function handleCellKeydown(e) {
  const r = parseInt(this.getAttribute('data-row'));
  const c = parseInt(this.getAttribute('data-col'));
  let nr = r, nc = c;

  if (e.key === 'Tab') {
    e.preventDefault();
    // Shift+Tab: 왼쪽 / Tab: 오른쪽 (열 끝이면 다음 행 첫 열)
    if (e.shiftKey) {
      if (nc > 0) nc--;
      else if (nr > 0) { nr--; nc = COLS - 1; }
    } else {
      if (nc < COLS - 1) nc++;
      else if (nr < ROWS - 1) { nr++; nc = 0; }
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (nr < ROWS - 1) nr++;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault(); if (nr < ROWS - 1) nr++;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault(); if (nr > 0) nr--;
  } else if (e.key === 'ArrowRight' && this.selectionStart === this.value.length) {
    if (nc < COLS - 1) nc++;
  } else if (e.key === 'ArrowLeft' && this.selectionStart === 0) {
    if (nc > 0) nc--;
  } else {
    return;  // 다른 키는 기본 동작 유지
  }

  const target = getCell(nr, nc);
  if (target) target.focus();
}


// ════════════════════════════════════════════════════════════════════════════
//  붙여넣기 (Ctrl+V) — 구분자 자동 감지
// ════════════════════════════════════════════════════════════════════════════

/**
 * 셀에서 paste 이벤트 발생 시 호출된다.
 * 클립보드 텍스트를 파싱해 현재 셀부터 채운다.
 * @param {ClipboardEvent} e
 */
function handlePaste(e) {
  e.preventDefault();   // 기본 붙여넣기 동작 차단

  const text = e.clipboardData.getData('text/plain');
  if (!text.trim()) return;

  const startR = parseInt(this.getAttribute('data-row'));
  const startC = parseInt(this.getAttribute('data-col'));

  // 텍스트 → 2D 배열로 파싱
  const rows = parseClipboard(text);
  if (!rows) return;

  // 그리드가 부족하면 확장
  const needR = startR + rows.length;
  const needC = startC + Math.max(...rows.map(r => r.length));

  if (needR > ROWS || needC > COLS) {
    const saved = saveGridData();
    ROWS = Math.max(needR, ROWS);
    COLS = Math.max(needC, COLS);
    buildGrid(saved);
  }

  // 셀에 데이터 입력
  rows.forEach((row, dr) => {
    row.forEach((val, dc) => {
      const cell = getCell(startR + dr, startC + dc);
      if (cell) cell.value = val;
    });
  });
}

/**
 * 클립보드 텍스트를 2D 배열로 파싱한다.
 * 구분자 우선순위: 탭(\t) → 쉼표(,) → 세미콜론(;)
 * @param {string} text - 클립보드 원문 텍스트
 * @returns {string[][]|null}
 */
function parseClipboard(text) {
  const lines = text.split(/\r?\n/);   // 줄 분리 (Windows \r\n, Unix \n 모두 처리)

  // 각 구분자로 시도해 2열 이상이 나오면 채택
  for (const delim of ['\t', ',', ';']) {
    const rows = lines.map(line => line.split(delim));
    const isMultiCol = rows.some(row => row.length > 1);
    if (isMultiCol) return rows;
  }

  // 구분자 감지 실패: 줄 단위 단일 열
  return lines.map(line => [line]);
}


// ════════════════════════════════════════════════════════════════════════════
//  행/열 추가·삭제
// ════════════════════════════════════════════════════════════════════════════

/** 그리드 아래에 빈 행 1개 추가 */
function addRow() {
  const saved = saveGridData();
  ROWS++;
  buildGrid(saved);
}

/**
 * 마지막 행 삭제 (최소 1행 유지)
 * 데이터가 있으면 confirm 확인
 */
function deleteRow() {
  if (ROWS <= 1) return;
  const lastRowHasData = Array.from({ length: COLS }, (_, c) => getCell(ROWS - 1, c))
    .some(cell => cell && cell.value.trim());

  if (lastRowHasData && !confirm(`${ROWS}행에 데이터가 있습니다. 삭제하시겠습니까?`)) return;

  const saved = saveGridData();
  ROWS--;
  buildGrid(saved);
}

/** 그리드 오른쪽에 빈 열 1개 추가 */
function addCol() {
  const saved = saveGridData();
  COLS++;
  buildGrid(saved);
}

/**
 * 마지막 열 삭제 (최소 1열 유지)
 * 데이터가 있으면 confirm 확인
 */
function deleteCol() {
  if (COLS <= 1) return;
  const lastColHasData = Array.from({ length: ROWS }, (_, r) => getCell(r, COLS - 1))
    .some(cell => cell && cell.value.trim());

  const colName = getColLabel(COLS - 1);
  if (lastColHasData && !confirm(`'${colName}'열에 데이터가 있습니다. 삭제하시겠습니까?`)) return;

  const saved = saveGridData();
  COLS--;
  buildGrid(saved);
}

/** 그리드 초기화 전 확인 */
function confirmClear() {
  if (!confirm('그리드의 모든 데이터를 초기화하시겠습니까?')) return;
  document.querySelectorAll('#csv-grid input').forEach(input => input.value = '');
}


// ════════════════════════════════════════════════════════════════════════════
//  컬럼 필터
// ════════════════════════════════════════════════════════════════════════════

/**
 * 현재 열 수에 맞게 컬럼 필터 체크박스를 다시 그린다.
 * 새로 추가된 열은 기본값 true(선택)으로 초기화한다.
 * 기존 열의 선택 상태는 colFilter 객체에서 유지한다.
 */
function refreshColFilter() {
  const container = document.getElementById('col-filter-checkboxes');
  container.innerHTML = '';

  // 범위 벗어난 열의 상태 정리
  Object.keys(colFilter).forEach(k => {
    if (parseInt(k) >= COLS) delete colFilter[k];
  });

  for (let c = 0; c < COLS; c++) {
    if (!(c in colFilter)) colFilter[c] = true;  // 새 열은 선택 상태

    const label = document.createElement('label');
    label.className = 'col-checkbox-label' + (colFilter[c] ? '' : ' unchecked');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = colFilter[c];
    cb.addEventListener('change', () => {
      colFilter[c] = cb.checked;
      label.classList.toggle('unchecked', !cb.checked);
    });

    label.appendChild(cb);
    label.appendChild(document.createTextNode(getColLabel(c)));
    container.appendChild(label);
  }
}

/** 모든 컬럼 체크박스 선택 */
function selectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = true;
  refreshColFilter();
}

/** 모든 컬럼 체크박스 해제 */
function deselectAllCols() {
  for (let c = 0; c < COLS; c++) colFilter[c] = false;
  refreshColFilter();
}


// ════════════════════════════════════════════════════════════════════════════
//  CSV 파일 불러오기
// ════════════════════════════════════════════════════════════════════════════

/** 숨겨진 file input을 프로그래밍으로 클릭 */
function triggerFileLoad() {
  document.getElementById('csv-file-input').click();
}

/**
 * 파일 선택 후 호출됨 (input[type=file] onchange)
 * FileReader API로 CSV 텍스트를 읽어 그리드에 로드한다.
 * @param {Event} e
 */
function loadCSVFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result;
    const rows = text.split(/\r?\n/).map(line => line.split(','));

    const newRows = Math.max(rows.length, ROWS);
    const newCols = Math.max(Math.max(...rows.map(r => r.length)), COLS);

    ROWS = newRows;
    COLS = newCols;
    buildGrid();

    rows.forEach((row, r) => {
      row.forEach((val, c) => {
        const cell = getCell(r, c);
        if (cell) cell.value = val.replace(/^"|"$/g, '');  // 따옴표 제거
      });
    });

    showToast(`✅ '${file.name}' 불러오기 완료`);
  };
  reader.onerror = () => showToast('❌ 파일을 읽을 수 없습니다.');
  reader.readAsText(file, 'UTF-8');

  // 같은 파일 재선택 가능하도록 value 초기화
  e.target.value = '';
}


// ════════════════════════════════════════════════════════════════════════════
//  출력 생성
// ════════════════════════════════════════════════════════════════════════════

/**
 * 출력 구분자 라디오 버튼에서 선택된 값을 반환한다.
 * @returns {string} ',', '\t', ';' 중 하나
 */
function getSelectedSep() {
  return document.querySelector('input[name="sep"]:checked').value;
}

/**
 * 그리드에서 선택된 열만 추출해 2D 배열로 반환한다.
 * 완전히 빈 행은 제외한다.
 * @param {number[]} selectedCols - 포함할 열 인덱스 배열
 * @returns {string[][]}
 */
function getGridData(selectedCols) {
  const result = [];
  for (let r = 0; r < ROWS; r++) {
    const row = selectedCols.map(c => {
      const cell = getCell(r, c);
      return cell ? cell.value : '';
    });
    // 완전히 빈 행은 제외
    if (row.some(v => v.trim())) result.push(row);
  }
  return result;
}

/**
 * 2D 배열을 CSV 문자열로 변환한다.
 * @param {string[][]} data
 * @param {string} sep - 구분자
 * @returns {string}
 */
function toCSVString(data, sep) {
  return data
    .map(row => row.map(v => {
      // 값에 구분자나 따옴표가 포함되면 따옴표로 감싼다
      if (v.includes(sep) || v.includes('"') || v.includes('\n')) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(sep))
    .join('\n');
}

/**
 * 접두 문자열 + CSV 데이터를 합쳐 출력을 생성한다.
 * 결과를 미리보기에 표시하고 lastOutput에 저장한다.
 *
 * 규칙:
 *   - 선택된 열이 없으면 경고
 *   - 둘 다 비어있으면 경고
 *   - 접두만 있으면 접두만 출력
 *   - CSV만 있으면 CSV만 출력
 *   - 둘 다 있으면 접두 + '\n' + CSV
 */
function generateOutput() {
  // 선택된 열 인덱스 수집
  const selectedCols = Object.entries(colFilter)
    .filter(([, v]) => v)
    .map(([k]) => parseInt(k));

  if (selectedCols.length === 0) {
    showToast('⚠️ 출력할 열을 하나 이상 선택해주세요.');
    return;
  }

  const prefix = document.getElementById('prefix-text').value.trimEnd();
  const sep = getSelectedSep();
  const gridData = getGridData(selectedCols);
  const csvStr = gridData.length ? toCSVString(gridData, sep) : '';

  if (!prefix.trim() && !csvStr) {
    showToast('⚠️ 그리드와 접두 문자열이 모두 비어있습니다.');
    return;
  }

  // 조합
  if (prefix.trim() && csvStr)       lastOutput = prefix + '\n' + csvStr;
  else if (prefix.trim())             lastOutput = prefix;
  else                                lastOutput = csvStr;

  updatePreview(lastOutput);
  showToast('✅ 출력이 생성되었습니다.');
}

/**
 * 출력 미리보기 영역을 갱신한다.
 * @param {string} text
 */
function updatePreview(text) {
  const pre = document.getElementById('output-preview');
  pre.textContent = text;
}


// ════════════════════════════════════════════════════════════════════════════
//  파일 저장 & 클립보드 복사
// ════════════════════════════════════════════════════════════════════════════

/**
 * lastOutput을 UTF-8 CSV 파일로 다운로드한다.
 * Web에서는 <a> 태그 + Blob으로 파일 저장을 구현한다.
 */
function saveToFile() {
  if (!lastOutput) { showToast('⚠️ 먼저 출력을 생성해주세요.'); return; }

  // Blob: 바이너리 데이터 객체 (파일 내용을 메모리에 담음)
  const blob = new Blob([lastOutput], { type: 'text/csv;charset=utf-8;' });

  // <a> 태그를 임시 생성해 클릭 → 다운로드 트리거
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'output.csv';  // 다운로드 파일명
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);   // 메모리 해제

  showToast('✅ 파일이 저장되었습니다.');
}

/**
 * lastOutput을 클립보드에 복사한다.
 * navigator.clipboard.writeText() : 현대적인 Clipboard API
 * (HTTPS 또는 localhost 환경에서만 동작)
 */
function copyToClipboard() {
  if (!lastOutput) { showToast('⚠️ 먼저 출력을 생성해주세요.'); return; }

  navigator.clipboard.writeText(lastOutput)
    .then(() => showToast('✅ 클립보드에 복사되었습니다.'))
    .catch(() => {
      // fallback: execCommand (구형 브라우저)
      const ta = document.createElement('textarea');
      ta.value = lastOutput;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✅ 클립보드에 복사되었습니다.');
    });
}


// ════════════════════════════════════════════════════════════════════════════
//  토스트 알림
// ════════════════════════════════════════════════════════════════════════════

let toastTimer = null;

/**
 * 화면 하단에 잠깐 표시되는 알림 메시지 (Toast)를 보여준다.
 * @param {string} msg - 표시할 메시지
 * @param {number} [duration=2000] - 표시 시간 (ms)
 */
function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}


// ════════════════════════════════════════════════════════════════════════════
//  전역 단축키
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  // Ctrl+Enter → 출력 생성
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    generateOutput();
  }
});


// ════════════════════════════════════════════════════════════════════════════
//  초기화 (페이지 로드 시 실행)
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  buildGrid();  // 기본 10×6 그리드 생성
});
