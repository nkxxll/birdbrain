// Function to fetch posts from the API
export const fetchPosts = async (): Promise<Post[]> => {
	const res = await fetch("/api/posts");
	if (!res.ok) {
		throw new Error("Network response was not ok");
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
  const res = await fetch('/api/savepost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error('Failed to save post');
  }
  return res;
};

// Function to "tweet" a post
export const tweetPost = async (text: string) => {
  const res = await fetch('/api/tweet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error('Failed to send tweet');
  }
  return res.json();
};
