import { prisma } from "./prisma";

/**
 * Data Sharing Rules Engine
 * Implements role hierarchy-based record visibility.
 */
export const getSubordinateIds = async (userId: string, companyId: string): Promise<string[]> => {
  const allUsers = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, managerId: true }
  });

  const subordinates = new Set<string>();
  const queue = [userId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const directReports = allUsers.filter(u => u.managerId === currentId).map(u => u.id);
    for (const reportId of directReports) {
      if (!subordinates.has(reportId)) {
        subordinates.add(reportId);
        queue.push(reportId);
      }
    }
  }

  return Array.from(subordinates);
};

/**
 * Returns Prisma "where" conditions for a given module (e.g. Lead, Deal)
 * based on the user's role and hierarchy.
 */
export const applyDataSharingRules = async (userId: string, companyId: string, role: string) => {
  if (role === "OWNER" || role === "MANAGER") {
    // Owners and Admins have global visibility
    return {};
  }

  const subordinateIds = await getSubordinateIds(userId, companyId);
  const allowedUserIds = [userId, ...subordinateIds];

  // Sharing constraint: If a record is marked private, check ownership/hierarchy
  return {
    OR: [
      { isPrivate: false },
      { ownerId: { in: allowedUserIds } }
    ]
  };
};
