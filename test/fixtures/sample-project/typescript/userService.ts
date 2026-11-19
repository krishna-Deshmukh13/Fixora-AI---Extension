/**
 * Fixora AI Sample Test File: TypeScript
 * Demonstrates type safety flaws, unbounded loops, and null dereferences.
 */

export interface User {
  id: string;
  name: string;
  email?: string;
}

export class UserService {
  private users: User[] = [];

  // Issue 1: Unsafe 'any' type casting
  public parseUserData(payload: string): any {
    return JSON.parse(payload) as any;
  }

  // Issue 2: Potential null dereference
  public getUserDomain(user: User): string {
    // email is optional, but accessed directly without checking
    return user.email.split('@')[1];
  }

  // Issue 3: Inefficient quadratic reduce / performance bottleneck
  public aggregateNames(users: User[]): string[] {
    return users.reduce((acc: string[], user: User) => {
      return [...acc, user.name]; // Quadratic array copying inside reduce
    }, []);
  }
}
