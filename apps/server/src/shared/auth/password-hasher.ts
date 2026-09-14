import argon2 from 'argon2';

export interface Argon2Port {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

const argon2id: Argon2Port = {
  hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
  verify: async (hash, password) => {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },
};

export const PASSWORD_HASHER = Symbol('PasswordHasher');

/** argon2id password hashing with a dummy verification path so unknown emails take comparable time (FR-008). */
export class PasswordHasher {
  #dummyHash: Promise<string> | undefined;

  constructor(private readonly argon: Argon2Port = argon2id) {}

  hash(password: string): Promise<string> {
    return this.argon.hash(password);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return this.argon.verify(hash, password);
  }

  async verifyOrDummy(storedHash: string | undefined, password: string): Promise<boolean> {
    if (storedHash === undefined) {
      this.#dummyHash ??= this.argon.hash('planix-dummy-password-for-timing');
      await this.argon.verify(await this.#dummyHash, password);
      return false;
    }
    return this.argon.verify(storedHash, password);
  }
}
