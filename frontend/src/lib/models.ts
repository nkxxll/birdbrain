// Define the Post interface to match the API response
interface Post {
	id: string;
	user_id: string;
	content: string;
	was_sent: number; // 0 or 1
	created_at: string; // ISO time string
}
