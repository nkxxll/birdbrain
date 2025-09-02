import { ApiError, type Post } from "./models";

export const pollProgress = async (): Promise<number> => {
	const res = await fetch("/api/pollprogress").catch((err) => {
		throw new ApiError(err);
	});
	if (!res.ok) {
		throw new ApiError(new Error("Network response was not ok"), res.status);
	}
	const data = await res.json();
	if (data.progress === undefined || typeof data.progress !== "number") {
		throw new Error("should never happen data format is defined well");
	}

	return data.progress;
};

// Function to fetch posts from the API
export const fetchPosts = async (): Promise<Post[]> => {
	const res = await fetch("/api/posts").catch((err) => {
		throw new ApiError(err);
	});
	if (!res.ok) {
		throw new ApiError(new Error("Network response was not ok"), res.status);
	}
	const data = await res.json();
	// Sort posts by creation time in descending order to show the newest first
	return data.sort(
		(a: Post, b: Post) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);
};

// Function to save a post to the API
export const savePost = async (text: string) => {
	const res = await fetch("/api/savepost", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text }),
	}).catch((err) => {
		throw new ApiError(err);
	});
	if (!res.ok) {
		throw new ApiError(new Error("Failed to save post"), res.status);
	}
	return res;
};

// Function to "tweet" a post
export const tweetPost = async (text: string, id?: number) => {
	const res = await fetch("/api/tweet", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(id ? { text, id } : { text }),
	}).catch((err) => {
		throw new ApiError(err);
	});
	if (!res.ok) {
		throw new ApiError(new Error("Failed to send tweet"), res.status);
	}
	return res.json();
};

export const deletePost = async (id: number) => {
	const res = await fetch(`/api/delete/${id}`, {
		method: "DELETE",
	}).catch((err) => {
		throw new ApiError(err);
	});
	if (!res.ok) {
		throw new ApiError(new Error("Failed to delete tweet"), res.status);
	}
	return res;
};
