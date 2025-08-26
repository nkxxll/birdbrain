import type { ApiError, Post } from "@/lib/models.ts";
import { Card, CardContent } from "./ui/card.tsx";
import type { UseMutationResult } from "@tanstack/react-query";
import toast, { CheckmarkIcon } from "react-hot-toast";
import { Copy } from "lucide-react";
import { Button } from "./ui/button.tsx";

async function copyToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success("Copied Post to Clipboard!");
		return true;
	} catch (err) {
		toast.error("Copying Post to Clipboard FAILED!");
		return false;
	}
}

export default function PostCard({
	post,
	postMutation,
}: {
	post: Post;
	postMutation: UseMutationResult<
		void,
		ApiError,
		{ text: string; id?: number },
		unknown
	>;
}) {
	return (
		<Card
			key={post.id}
			className={`p-4 ${post.was_sent === 1 ? "bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200" : ""}`}
		>
			<CardContent className="p-0">
				<div className="text-lg leading-relaxed flex items-center gap-2">
					{post.content}
					{post.was_sent === 1 && (
						<span role="img" aria-label="sent">
							<CheckmarkIcon />
						</span>
					)}
				</div>
				<p className="text-sm text-gray-500 mt-2 text-right">
					{new Date(post.created_at).toLocaleString()}
				</p>
				{post.was_sent === 0 && (
					<div className="mt-4 flex gap-2 justify-end">
						<Button
							size="sm"
							disabled={postMutation.isPending}
							onClick={() => copyToClipboard(post.content)}
						>
							<Copy />
						</Button>
						<Button
							size="sm"
							disabled={postMutation.isPending}
							onClick={() =>
								postMutation.mutate({ text: post.content, id: post.id })
							}
						>
							Send Now
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
