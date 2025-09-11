// Define the Post interface to match the API response
export interface Post {
	id: number;
	user_id: string;
	content: string;
	was_sent: number; // 0 or 1
	created_at: string; // ISO time string
}

export class ApiError extends Error {
	public status?: number;
	constructor(error: Error, status?: number) {
		super(error.message);

    this.status = status;
	}
}

export interface UserHandle {
  id?: number;
  readonly username: string,
  readonly handle: string,
}
