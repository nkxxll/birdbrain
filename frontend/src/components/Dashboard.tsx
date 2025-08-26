import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savePost, fetchPosts, tweetPost } from "@/lib/api";

// Main component for the site
export default function App() {
	// Use the useMutation hook for the tweet and save post logic
	const queryClient = useQueryClient();
	const savePostMutation = useMutation({
		mutationFn: async (text: string) => {
			// Then save the post
			await savePost(text);
		},
		onSuccess: () => {
			// Invalidate the 'posts' query to refetch the data and update the list
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			setNewPostContent(""); // Clear the textarea after successful post
		},
		onError: (err) => {
			console.error("Failed to post:", err);
		},
	});

	const tweetPostMutation = useMutation({
		mutationFn: async (text: string) => {
			// Send the tweet first
			await tweetPost(text);
			// Then save the post
			await savePost(text);
		},
		onSuccess: () => {
			// Invalidate the 'posts' query to refetch the data and update the list
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			setNewPostContent(""); // Clear the textarea after successful post
		},
		onError: (err) => {
			console.error("Failed to post:", err);
		},
	});

	const { data, isError, isLoading, error } = useQuery({
		queryKey: ["posts"],
		queryFn: fetchPosts,
	});

	const [newPostContent, setNewPostContent] = useState("");
	const maxCharacters = 280;

	// Function to handle character limit and update content
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const text = e.target.value;
		if (text.length <= maxCharacters) {
			setNewPostContent(text);
		}
	};

	if (isError) return "error..." + error;
	if (isLoading) return "loading...";

	return (
		<div className="flex-1 grow grid grid-cols-1 md:grid-cols-3 gap-8 bg-gray-50 dark:bg-gray-950">
			{/* Left column: Textarea for creating a new post */}
			<div className="col-span-1 p-4">
				<Card className="h-full flex flex-col">
					<CardHeader className="pb-4">
						<CardTitle className="text-2xl font-bold">
							Create a New Post
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col flex-1">
						<Textarea
							className="flex-1 resize-none mb-2 min-h-[100px]"
							placeholder="What's on your mind? (280 characters max)"
							value={newPostContent}
							onChange={handleTextareaChange}
						/>
						<div className="text-right text-sm text-muted-foreground mb-4">
							{newPostContent.length}/{maxCharacters}
						</div>
						<div className="flex flex-row gap-2">
							<Button
								onClick={() => tweetPostMutation.mutate(newPostContent)}
								className="grow"
								disabled={newPostContent.trim().length === 0}
							>
								Post
							</Button>
							<Button
								onClick={() => savePostMutation.mutate(newPostContent)}
								className="grow"
								disabled={newPostContent.trim().length === 0}
							>
								Save
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Right column: List of posts */}
			<div className="col-span-1 md:col-span-2 p-4">
				<h2 className="text-2xl font-bold mb-4">Recent Posts</h2>
				{data?.length === 0 ? (
					<p className="text-gray-500 text-center mt-10">
						No posts yet. Start by writing one!
					</p>
				) : (
					<ScrollArea className="h-[calc(100vh-150px)]">
						<div className="space-y-4 pr-4">
							{data?.map((post) => (
								<Card key={post.id} className="p-4 rounded-xl shadow-md">
									<CardContent className="p-0">
										<p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
											{post.content}
										</p>
										<p className="text-sm text-gray-500 mt-2 text-right">
											{post.created_at}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>
				)}
			</div>
		</div>
	);
}
