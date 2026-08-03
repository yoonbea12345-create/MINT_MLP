// 전체화면 '진입'은 더 이상 웹에서 하지 않는다 — Fullscreen API를 부르면 안드로이드 크롬이
// 페이지 밖 레이어에 종료 안내 팝업을 띄우고, 그건 어떤 웹 API로도 숨길 수 없다.
// 해제만 남겨둔다: 브라우저 메뉴 등으로 이미 전체화면인 사용자에게 설치 안내를 보여줘야 하므로.
export async function exitAppFullscreen(): Promise<void> {
  if (!document.fullscreenElement || !document.exitFullscreen) return;

  try {
    await document.exitFullscreen();
  } catch {
    // 브라우저가 해제를 거부해도 설치 안내는 계속 보여준다.
  }
}

export function navigateInApp(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
