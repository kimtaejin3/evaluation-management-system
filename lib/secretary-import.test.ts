import { describe, it, expect } from 'vitest'
import { autoDetectSecretaryMapping, buildSecretaries, secretaryLooksLikeHeader } from './secretary-import'

describe('secretary-import', () => {
  it('테이블 머리글(이름/아이디/비밀번호/연락처)을 자동 매핑한다', () => {
    expect(autoDetectSecretaryMapping(['이름', '아이디', '비밀번호', '연락처'])).toEqual([
      'name',
      'username',
      'password',
      'phone',
    ])
  })

  it('동의어(담당자/계정/비번/휴대폰)도 인식한다', () => {
    expect(autoDetectSecretaryMapping(['담당자', '계정', '비번', '휴대폰'])).toEqual([
      'name',
      'username',
      'password',
      'phone',
    ])
    expect(secretaryLooksLikeHeader(['담당자', '연락처'])).toBe(true)
    expect(secretaryLooksLikeHeader(['안녕', '하세요'])).toBe(false)
  })

  it('행을 초안으로 변환하고 빈 값은 null로 둔다', () => {
    const grid = [
      ['이름', '아이디', '비밀번호', '연락처'],
      ['김담당', 'gansa1', '', '010-1234-5678'],
      ['이담당', '', 'pw1234', ''],
    ]
    const mapping = autoDetectSecretaryMapping(grid[0])
    const { rows } = buildSecretaries(grid, mapping, { hasHeader: true })
    expect(rows).toEqual([
      { name: '김담당', username: 'gansa1', phone: '010-1234-5678', password: null },
      { name: '이담당', username: null, phone: null, password: 'pw1234' },
    ])
  })

  it('이름 열이 없으면 경고하고 빈 결과', () => {
    const { rows, warnings } = buildSecretaries([['아이디', '연락처'], ['a', 'b']], ['username', 'phone'], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/이름/)
  })

  it('같은 아이디/이름 중복은 한 번만', () => {
    const grid = [
      ['이름', '아이디'],
      ['김담당', 'gansa1'],
      ['김담당', 'gansa1'],
    ]
    const { rows } = buildSecretaries(grid, ['name', 'username'], { hasHeader: true })
    expect(rows).toHaveLength(1)
  })
})
