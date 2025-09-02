import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savePost, fetchPosts, tweetPost, pollProgress } from "@/lib/api";
import type { ApiError, UserHandle } from "@/lib/models";
import { useRouter } from "@tanstack/react-router";
import { toast } from "react-hot-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import PostCard from "./PostCard";
import { TWITTER_HANELE_COMPLETIONS } from "@/lib/completion_list";
import { Progress } from "./ui/progress";

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
		onError: (err: ApiError) => {
			if (err.status && err.status === 401) {
				const router = useRouter();
				toast.error(`${err.message}\nYou might need to login first!`);
				router.navigate({ to: "/" });
			}
		},
	});

	const tweetPostMutation = useMutation({
		mutationFn: async ({ text, id }: { text: string; id?: number }) => {
			await tweetPost(text, id);
		},
		onSuccess: () => {
			toast.success("Post was sent successfully!");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			setNewPostContent("");
		},
		onError: (err: ApiError) => {
			if (err.status && err.status === 401) {
				const router = useRouter();
				toast.error(`${err.message}\nYou might need to login first!`);
				router.navigate({ to: "/" });
			}
		},
	});

	const [progress, setProgress] = useState(0);
	const lastProgress = useRef<number>(0);

	const pollProgressMutation = useMutation({
		mutationFn: pollProgress,
		onSuccess: (data: number) => {
			console.log(
				data,
				lastProgress.current,
				data === 0 && lastProgress.current === 90,
			);
			if (data === 0 && lastProgress.current === 90) {
				toast.success("Send new post randomly");
				queryClient.invalidateQueries({ queryKey: ["posts"] });
			}
			lastProgress.current = data;
			setProgress(data);
		},
		onError: (err: ApiError) => {
			if (err.status && err.status === 401) {
				const router = useRouter();
				toast.error(`${err.message}\nYou might need to login first!`);
				router.navigate({ to: "/" });
			}
		},
	});

	useEffect(() => {
		const interval = setInterval(() => {
			pollProgressMutation.mutate();
		}, 1000 * 60); // 1 min
		return () => clearInterval(interval);
	}, []);

	const { data, isError, isLoading, error } = useQuery({
		queryKey: ["posts"],
		queryFn: fetchPosts,
		retry: false,
	});

	const [newPostContent, setNewPostContent] = useState("");
	const maxCharacters = 280;
	const [suggestions, setSuggestions] = useState<UserHandle[]>([]);
	const limitedSuggestions = useMemo(() => {
		return suggestions.length > 5 ? suggestions.slice(0, 5) : suggestions;
	}, [suggestions]);

	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const text = e.target.value;
		if (text.length <= maxCharacters) {
			setNewPostContent(text);
		}

		const textarea = e.target;
		const cursorPos = textarea.selectionStart;
		const textBeforeCursor = textarea.value.substring(0, cursorPos);
		const words = textBeforeCursor.split(/\s+/);
		const lastWord = words[words.length - 1];

		setSuggestions([]);

		if (lastWord.startsWith("@")) {
			const query = lastWord.substring(1).toLowerCase();
			const matches = TWITTER_HANELE_COMPLETIONS.filter(
				(user) =>
					user.handle.toLowerCase().startsWith("@" + query) ||
					user.username.toLowerCase().startsWith(query),
			);
			setSuggestions(matches);
		}
	};

	if (isError) {
		const apiError = error as ApiError;
		if (apiError.status && apiError.status === 401) {
			const router = useRouter();
			toast.error(`${apiError.message}\nYou might need to login first!`);
			router.navigate({ to: "/" });
		}
	}
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
							onKeyDown={(e) => {
								if (e.code === "Enter" && suggestions.length > 0) {
									const suggestion = suggestions[0];
									setNewPostContent((content) => {
										const words = content.split(/\s+/);
										const lastIndex = content.lastIndexOf(
											words[words.length - 1],
										);
										return content.slice(0, lastIndex) + suggestion.handle;
									});
									e.preventDefault();
								}
							}}
						/>
						<div id="suggestions" className="grid grid-cols-3 gap-2">
							{suggestions.length > 0 &&
								limitedSuggestions?.map((suggestion) => {
									return (
										<Button
											variant={"outline"}
											className="p-4 text-xs"
											onClick={() => {
												setNewPostContent((content) => {
													const words = content.split(/\s+/);
													const lastIndex = content.lastIndexOf(
														words[words.length - 1],
													);
													return (
														content.slice(0, lastIndex) + suggestion.handle
													);
												});
											}}
										>
											{suggestion.username} <br /> {suggestion.handle}
										</Button>
									);
								})}
						</div>
						<div className="text-right text-sm text-muted-foreground mb-4">
							{newPostContent.length}/{maxCharacters}
						</div>
						<div className="flex flex-row gap-2">
							<Button
								onClick={() =>
									tweetPostMutation.mutate({ text: newPostContent })
								}
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
			<div className="flex flex-col col-span-1 md:col-span-2 p-4">
				<h2 className="text-2xl font-bold">Recent Posts</h2>
				<div className="p-4">
					<Progress value={progress} />
				</div>
				{data?.length === 0 ? (
					<p className="text-gray-500 text-center mt-10">
						No posts yet. Start by writing one!
					</p>
				) : (
					<ScrollArea className="grow h-[calc(100vh-150px)]">
						<div className="space-y-4 pr-4">
							{data?.map((post) => (
								<PostCard
									key={post.id}
									post={post}
									postMutation={tweetPostMutation}
								/>
							))}
						</div>
					</ScrollArea>
				)}
			</div>
		</div>
	);
}
