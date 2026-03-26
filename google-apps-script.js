// ============================================================
// Google Apps Script — 외국인 따라매매 대시보드 API
// ============================================================
// 사용법:
// 1. Google Sheet 새로 만들기 (시트 이름: "trades")
// 2. 확장 프로그램 → Apps Script 열기
// 3. 이 코드 전체를 붙여넣기
// 4. 배포 → 새 배포 → 웹앱 → "누구나" 접근 가능 → 배포
// 5. 생성된 URL을 index.html의 APPS_SCRIPT_URL에 입력
// ============================================================

const SHEET_NAME = 'trades';
const PASSWORD = 'average2026'; // 원하는 비밀번호로 변경하세요

// 시트 헤더 (첫 행)
const HEADERS = [
  'date', 'stock', 'buyPrice', 'sellPrice',
  'kospi', 'kosdaq', 'nasdaq', 'fx',
  'sector', 'gap', 'memo'
];

// --- 인증 ---
function checkAuth(e) {
  const pw = (e && e.parameter && e.parameter.pw) || '';
  return pw === PASSWORD;
}

// --- GET: 전체 데이터 읽기 ---
function doGet(e) {
  if (!checkAuth(e)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return jsonResponse({ trades: [] });
  }

  const headers = data[0];
  const trades = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // 빈 행 스킵
    const trade = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      // 숫자 필드 변환
      if (['buyPrice', 'sellPrice'].includes(h)) {
        val = parseInt(val) || 0;
      } else if (['kospi', 'kosdaq', 'nasdaq', 'fx', 'gap'].includes(h)) {
        val = val === '' || val === null ? null : parseFloat(val);
      } else if (h === 'date' && val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        val = String(val || '');
      }
      trade[h] = val;
    });
    trades.push(trade);
  }

  return jsonResponse({ trades });
}

// --- POST: 전체 데이터 저장 (덮어쓰기) ---
function doPost(e) {
  if (!checkAuth(e)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  try {
    const body = JSON.parse(e.postData.contents);
    const trades = body.trades || [];

    const sheet = getOrCreateSheet();

    // 기존 데이터 삭제 (헤더 제외)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    }

    // 새 데이터 쓰기
    if (trades.length > 0) {
      const rows = trades.map(t => HEADERS.map(h => {
        const val = t[h];
        if (val === null || val === undefined) return '';
        return val;
      }));
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return jsonResponse({ success: true, count: trades.length });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// --- 유틸 ---
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
