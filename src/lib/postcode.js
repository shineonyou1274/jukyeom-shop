// 다음(카카오) 우편번호 검색
let loading
function loadScript() {
  if (window.daum?.Postcode) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    s.onload = resolve
    s.onerror = () => { loading = null; reject(new Error('주소 검색을 불러오지 못했어요.')) }
    document.head.appendChild(s)
  })
  return loading
}

export async function searchAddress() {
  await loadScript()
  return new Promise((resolve) => {
    new window.daum.Postcode({
      oncomplete: (d) => resolve({ zipcode: d.zonecode, address1: d.roadAddress || d.jibunAddress }),
    }).open()
  })
}
