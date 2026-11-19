// Sample TypeScript file with deliberate bugs for Fixora AI testing
export interface User {
  id: number;
  name: string;
  email?: string;
}

export function getUserDisplayName(user: User | undefined): string {
  // BUG 1: Potential null/undefined dereference
  return user.name.toUpperCase();
}

export async function fetchUserData(userId: number): Promise<User> {
  // BUG 2: Unhandled promise / missing try-catch
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const data = await response.json();
  
  // BUG 3: Loose comparison with potentially wrong type
  if (data.id == "0") {
    throw new Error("Invalid user ID");
  }

  return data;
}
