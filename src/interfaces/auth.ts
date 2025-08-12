export interface SignUpInput {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
