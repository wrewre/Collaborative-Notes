import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 10)

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      password: passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      password: passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    },
  })

  // Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
    },
  })

  // Add members
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: alice.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: alice.id,
      role: 'owner',
    },
  })

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: bob.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: bob.id,
      role: 'editor',
    },
  })

  // Create a folder
  const folder = await prisma.folder.create({
    data: {
      workspaceId: workspace.id,
      name: 'Getting Started',
      createdById: alice.id,
    },
  })

  // Create demo notes
  await prisma.note.create({
    data: {
      workspaceId: workspace.id,
      folderId: folder.id,
      title: 'Welcome to Collab Notes!',
      contentText: 'This is a collaborative notes app. Start editing and see changes in real-time!',
      createdById: alice.id,
    },
  })

  await prisma.note.create({
    data: {
      workspaceId: workspace.id,
      title: 'Meeting Notes — June 2025',
      contentText: 'Discuss project roadmap and assign tasks.',
      createdById: bob.id,
    },
  })

  console.log('✅ Seed complete!')
  console.log(`   👤 alice@example.com / password123`)
  console.log(`   👤 bob@example.com   / password123`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
