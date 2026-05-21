import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { Client } from 'ssh2'

// ---------------------------------------------------------------------------
// Password encryption (AES-256-CBC, key from STORAGE_ENCRYPTION_KEY env var)
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env.STORAGE_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('STORAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptPassword(password: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPassword(encrypted: string): string {
  const key = getEncryptionKey()
  const [ivHex, encHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encData = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(encData), decipher.final()]).toString('utf8')
}

// ---------------------------------------------------------------------------
// SFTP upload
// ---------------------------------------------------------------------------

export async function uploadViaSftp(opts: {
  host: string
  port: number
  username: string
  password: string
  remotePath: string
  buffer: Buffer
}): Promise<void> {
  const { host, port, username, password, remotePath, buffer } = opts

  return new Promise((resolve, reject) => {
    const conn = new Client()

    const timeout = setTimeout(() => {
      conn.end()
      reject(new Error('SFTP connection timed out'))
    }, 15_000)

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { clearTimeout(timeout); conn.end(); reject(err); return }

        // Ensure remote directory exists before writing
        const dir = remotePath.substring(0, remotePath.lastIndexOf('/'))
        sftp.mkdir(dir, { mode: 0o755 }, () => {
          // Ignore mkdir errors — directory may already exist
          const stream = sftp.createWriteStream(remotePath)
          stream.on('close', () => { clearTimeout(timeout); conn.end(); resolve() })
          stream.on('error', (e: Error) => { clearTimeout(timeout); conn.end(); reject(e) })
          stream.write(buffer)
          stream.end()
        })
      })
    })

    conn.on('error', (e) => { clearTimeout(timeout); reject(e) })

    conn.connect({ host, port, username, password, readyTimeout: 10_000 })
  })
}

// ---------------------------------------------------------------------------
// Connection test (used by settings UI later)
// ---------------------------------------------------------------------------

export async function testSftpConnection(opts: {
  host: string
  port: number
  username: string
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await new Promise<void>((resolve, reject) => {
      const conn = new Client()
      const timeout = setTimeout(() => { conn.end(); reject(new Error('Connection timed out')) }, 10_000)
      conn.on('ready', () => { clearTimeout(timeout); conn.end(); resolve() })
      conn.on('error', (e) => { clearTimeout(timeout); reject(e) })
      conn.connect({ ...opts, readyTimeout: 8_000 })
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
