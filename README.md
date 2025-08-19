
# 끝말잇기 PWA (Pyodide)

이 폴더를 그대로 GitHub Pages/Netlify 등에 올리면 아이폰/안드로이드에서 홈 화면에 추가해 '설치형'처럼 사용할 수 있습니다.

## 파일 설명
- `index.html` : 메인 페이지
- `styles.css` : 스타일
- `app.js` : UI + Pyodide 초기화 + 게임 로직 연동
- `manifest.json` : PWA 메타데이터
- `service-worker.js` : 오프라인 캐시
- `kkunmal_wordchain.py` : (선택) 형의 파이썬 로직. 동일 경로에 두면 자동으로 로드됩니다.
- `icons/` : 앱 아이콘

## 사용 방법
1. 이 폴더를 통째로 웹에 호스팅 (GitHub Pages 권장).
2. iPhone Safari 또는 Android Chrome으로 접속.
3. 공유 버튼 → **홈 화면에 추가**.
4. 앱 아이콘이 생기고 전체화면으로 실행됩니다.

## 주의
- Pyodide는 CDN에서 불러오므로 첫 로딩이 다소 느릴 수 있습니다.
- `kkunmal_wordchain.py`에서 `is_valid_move(prev, curr)` 함수가 있으면 그걸 사용합니다.
  - 없다면 기본 규칙(이전 단어 마지막 글자 = 다음 단어 첫 글자)을 사용합니다.
- 오프라인 완전 지원을 원하면 Pyodide 파일을 로컬에 포함하고 service worker 캐시에 추가하세요 (용량 ↑).
