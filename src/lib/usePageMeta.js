import { useEffect } from 'react'

const SITE = '천왕봉 죽염'
const DEFAULT_TITLE = `${SITE} | 지리산 산청에서 아홉 번 구운 죽염`

// 페이지마다 브라우저 탭 제목과 설명을 바꾼다
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : DEFAULT_TITLE
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}
