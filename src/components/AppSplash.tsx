interface AppSplashProps {
  exiting: boolean;
}

export default function AppSplash({ exiting }: AppSplashProps) {
  return (
    <main
      className={`app-entry-splash${exiting ? ' app-entry-splash--exit' : ''}`}
      aria-label="MINT 앱 시작 화면"
    >
      <div className="app-entry-splash__aurora app-entry-splash__aurora--top" aria-hidden />
      <div className="app-entry-splash__aurora app-entry-splash__aurora--bottom" aria-hidden />
      <div className="app-entry-splash__grain" aria-hidden />

      <div className="app-entry-splash__content">
        <div className="app-entry-splash__emblem" aria-hidden>
          <span className="app-entry-splash__orbit app-entry-splash__orbit--outer" />
          <span className="app-entry-splash__orbit app-entry-splash__orbit--inner" />
          <span className="app-entry-splash__pin app-entry-splash__pin--one" />
          <span className="app-entry-splash__pin app-entry-splash__pin--two" />
          <span className="app-entry-splash__halo" />
          <img src="/image/mascot-bird.webp" alt="" className="app-entry-splash__mascot" />
        </div>

        <div className="app-entry-splash__copy">
          <p className="app-entry-splash__eyebrow">MEET IN ONE TAP</p>
          <h1 className="app-entry-splash__wordmark">MINT</h1>
          <p className="app-entry-splash__tagline">만남의 시작을, 더 가볍게.</p>
        </div>
      </div>

      <div className="app-entry-splash__signature" aria-hidden>
        <span />
        <p>오늘의 만남이 기대되도록</p>
        <span />
      </div>
    </main>
  );
}
