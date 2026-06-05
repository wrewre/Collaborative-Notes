import jwt from 'jsonwebtoken'
import { JwtPayload } from '@collab-notes/types'

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production-min32chars'

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    return payload
  } catch {
    return null
  }
}
