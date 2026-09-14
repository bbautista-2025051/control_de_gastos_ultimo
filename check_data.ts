import jwt from "jsonwebtoken";
import { prisma } from "./backend/src/lib/prisma";
import { env } from "./backend/src/config/env";

(async () => {
  // Get a user to create a token
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found");
    await prisma.$disconnect();
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, { expiresIn: "1h" });
  console.log("Token generated for user:", user.id);

  const res = await fetch("http://localhost:4000/api/expenses/summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("incomeMonth:", data.incomeMonth);
  console.log("expenseMonth:", data.expenseMonth);
  console.log("balance:", data.balance);
  console.log("categories:", JSON.stringify(data.categories));
  console.log("monthly:", JSON.stringify(data.monthly));

  await prisma.$disconnect();
})();
