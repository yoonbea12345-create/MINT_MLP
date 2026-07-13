export async function requestAppFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  if (!document.documentElement.requestFullscreen) return false;

  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    // 모바일 브라우저 정책이나 iOS 미지원 환경에서는 설치형 전체화면 설정으로 폴백한다.
    return false;
  }
}

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
