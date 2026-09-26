export default function SetupNotice() {
  return (
    <div className="container page narrow">
      <h1>설정이 필요해요</h1>
      <p>
        <code>.env</code> 파일에 <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 넣으면
        쇼핑몰이 동작해요. 자세한 방법은 <code>README.md</code>를 참고하세요.
      </p>
    </div>
  )
}
