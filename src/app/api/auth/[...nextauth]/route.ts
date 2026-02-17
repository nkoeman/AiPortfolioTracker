import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

// Creates NextAuth request handlers for both GET and POST auth callbacks.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
