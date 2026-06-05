import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

declare module 'fastify' {
  interface FastifyInstance {
    s3: S3Client
    getPresignedUploadUrl: (key: string, mimeType: string) => Promise<string>
    getPresignedDownloadUrl: (key: string) => Promise<string>
    deleteS3Object: (key: string) => Promise<void>
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true, // Required for MinIO
  })

  const bucket = process.env.S3_BUCKET || 'collab-notes'

  fastify.decorate('s3', s3)

  fastify.decorate('getPresignedUploadUrl', async (key: string, mimeType: string) => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    })
    return getSignedUrl(s3, command, { expiresIn: 3600 })
  })

  fastify.decorate('getPresignedDownloadUrl', async (key: string) => {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    return getSignedUrl(s3, command, { expiresIn: 3600 })
  })

  fastify.decorate('deleteS3Object', async (key: string) => {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key })
    await s3.send(command)
  })
}

export const s3Plugin = fp(plugin, { name: 's3' })
