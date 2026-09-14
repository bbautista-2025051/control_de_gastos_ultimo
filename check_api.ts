import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "GENERA_UN_SECRETO_AQUI";

// Use a userId from the DB
const payload = { userId: "cmsq64e220000akftm66h5ay1", role: "USER" };
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

const res = await fetch("http://localhost:4000/api/expenses/summary", {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
console.log("Status:", res.status);
console.log(JSON.stringify(data, null, 2));
