import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getUserFieldSet() {
  const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User');
  return new Set((userModel?.fields ?? []).map((field) => field.name));
}

async function main() {
  const userFields = getUserFieldSet();
  const userDelegate = prisma.user as unknown as {
    findFirst(args?: Record<string, unknown>): Promise<{ id: string } | null>;
    upsert(args: Record<string, unknown>): Promise<unknown>;
    create(args: Record<string, unknown>): Promise<unknown>;
  };

  if (userFields.has('email')) {
    await userDelegate.upsert({
      where: { email: 'seed@example.com' },
      update: {},
      create: { email: 'seed@example.com' },
    });
    return;
  }

  const existingUser = await userDelegate.findFirst({ select: { id: true } });
  if (!existingUser) {
    const data = userFields.has('status') ? { status: 'active' } : {};
    await userDelegate.create({ data });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
