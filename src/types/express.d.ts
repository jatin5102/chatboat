declare global {
  namespace Express {
    interface User {
      id: string;
      role: "USER" | "ADMIN";
      email?: string;
      name?: string | null;
    }
  }
}

export {};
