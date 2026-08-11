import { describe, it, expect } from 'vitest'
import { canEvaluatorEdit, cellStatus, cellStatusLabel, canDecide, reviewFlags, chairReviewFlags } from './submission'

describe('canEvaluatorEdit', () => {
  it('없음/DRAFT/REJECTED는 편집 가능', () => {
    expect(canEvaluatorEdit(null)).toBe(true)
    expect(canEvaluatorEdit('DRAFT')).toBe(true)
    expect(canEvaluatorEdit('REJECTED')).toBe(true)
  })
  it('SUBMITTED/APPROVED는 잠금', () => {
    expect(canEvaluatorEdit('SUBMITTED')).toBe(false)
    expect(canEvaluatorEdit('APPROVED')).toBe(false)
  })
})

describe('cellStatus', () => {
  it('제출/승인/반려 상태를 우선 반영', () => {
    expect(cellStatus('SUBMITTED', 3, 3)).toBe('submitted')
    expect(cellStatus('APPROVED', 3, 3)).toBe('approved')
    expect(cellStatus('REJECTED', 1, 3)).toBe('rejected')
  })
  it('상태 없음/DRAFT는 입력 수로 판정', () => {
    expect(cellStatus(null, 0, 3)).toBe('none')
    expect(cellStatus(null, 2, 3)).toBe('partial')
    expect(cellStatus('DRAFT', 3, 3)).toBe('entered')
  })
  it('전 항목 수 0이면 none', () => {
    expect(cellStatus(null, 0, 0)).toBe('none')
  })
})

describe('cellStatusLabel', () => {
  it('한국어 라벨', () => {
    expect(cellStatusLabel('entered')).toBe('입력완료')
    expect(cellStatusLabel('submitted')).toBe('제출완료')
    expect(cellStatusLabel('approved')).toBe('승인')
    expect(cellStatusLabel('rejected')).toBe('반려')
  })
})

describe('canDecide', () => {
  it('SUBMITTED만 승인/반려 가능', () => {
    expect(canDecide('SUBMITTED')).toBe(true)
    expect(canDecide('APPROVED')).toBe(false)
    expect(canDecide('DRAFT')).toBe(false)
    expect(canDecide(null)).toBe(false)
  })
})

describe('reviewFlags', () => {
  it('평가의견→제출→위원장→담당자→관리자, 담당자/관리자는 의견서 검토 상태로 판정', () => {
    // 미제출
    expect(reviewFlags({ status: null, scored: false, chairConfirmed: false, secretaryReviewed: false, masterApproved: false }))
      .toEqual([false, false, false, false, false])
    // 점수만 입력
    expect(reviewFlags({ status: null, scored: true, chairConfirmed: false, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, false, false, false, false])
    // 제출(위원장 검토 전)
    expect(reviewFlags({ status: 'SUBMITTED', scored: true, chairConfirmed: false, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, true, false, false, false])
    // 제출 + 위원장 검토
    expect(reviewFlags({ status: 'SUBMITTED', scored: true, chairConfirmed: true, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, true, true, false, false])
    // 담당자 검토 완료(의견서 SUBMITTED) — 제출된 위원만 담당자 검토 완료로 표시
    expect(reviewFlags({ status: 'SUBMITTED', scored: true, chairConfirmed: true, secretaryReviewed: true, masterApproved: false }))
      .toEqual([true, true, true, true, false])
    // 미제출 위원은 담당자 검토 완료여도 4단계 false
    expect(reviewFlags({ status: null, scored: false, chairConfirmed: false, secretaryReviewed: true, masterApproved: true }))
      .toEqual([false, false, false, false, false])
    // 관리자 승인(의견서 APPROVED)
    expect(reviewFlags({ status: 'SUBMITTED', scored: true, chairConfirmed: true, secretaryReviewed: true, masterApproved: true }))
      .toEqual([true, true, true, true, true])
  })
})

describe('chairReviewFlags', () => {
  it('평가의견→종합의견→제출→담당자→관리자 순으로 단계 완료', () => {
    // 아무것도 안 함
    expect(chairReviewFlags({ status: null, scored: false, opinionWritten: false, secretaryReviewed: false, masterApproved: false }))
      .toEqual([false, false, false, false, false])
    // 점수만 입력
    expect(chairReviewFlags({ status: null, scored: true, opinionWritten: false, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, false, false, false, false])
    // 점수 + 종합의견(아직 제출 전) — 위원장 제출은 종합의견 후
    expect(chairReviewFlags({ status: null, scored: true, opinionWritten: true, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, true, false, false, false])
    // 제출완료
    expect(chairReviewFlags({ status: 'SUBMITTED', scored: true, opinionWritten: true, secretaryReviewed: false, masterApproved: false }))
      .toEqual([true, true, true, false, false])
    // 담당자 검토 완료(의견서 SUBMITTED)
    expect(chairReviewFlags({ status: 'SUBMITTED', scored: true, opinionWritten: true, secretaryReviewed: true, masterApproved: false }))
      .toEqual([true, true, true, true, false])
    // 관리자 승인(의견서 APPROVED)
    expect(chairReviewFlags({ status: 'SUBMITTED', scored: true, opinionWritten: true, secretaryReviewed: true, masterApproved: true }))
      .toEqual([true, true, true, true, true])
  })
  it('제출 상태면 점수 입력 플래그도 완료로 본다', () => {
    expect(chairReviewFlags({ status: 'SUBMITTED', scored: false, opinionWritten: true, secretaryReviewed: false, masterApproved: false })[0]).toBe(true)
  })
})
