import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'

// R2 버킷 CORS 설정 — 브라우저 → R2 직접 업로드(presigned PUT)에 필요. 멱등(재실행 안전).
// 실행: node --env-file=.env --import tsx scripts/setup-r2-cors.ts
// 허용 오리진: 로컬 개발 + Vercel 배포(프리뷰 포함). 커스텀 도메인을 붙이면 여기에 추가할 것.
const ORIGINS = ['http://localhost:3000', 'https://*.vercel.app']

async function main() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('R2 환경변수가 없습니다 (.env의 R2_* 4개 필요)')
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['content-type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )

  const after = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }))
  console.log('CORS 적용 완료:', JSON.stringify(after.CORSRules, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
