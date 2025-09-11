import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchTwitterHandles,
	createTwitterHandle,
	updateTwitterHandle,
	deleteTwitterHandle,
} from "@/lib/api";
import type { UserHandle } from "@/lib/models";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "react-hot-toast";

export default function HandleManager() {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<number | null>(null);
	const [newHandle, setNewHandle] = useState<Partial<UserHandle>>({
		username: "",
		handle: "",
	});
	const [editedHandle, setEditedHandle] = useState<UserHandle | null>(null);

	const { data: handles, isLoading } = useQuery<UserHandle[]>({
		queryKey: ["twitter_handles"],
		queryFn: fetchTwitterHandles,
	});

	const createMutation = useMutation({
		mutationFn: createTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			setNewHandle({ username: "", handle: "" });
			toast.success("Handle created!");
		},
		onError: () => {
			toast.error("Failed to create handle.");
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			setEditingId(null);
			setEditedHandle(null);
			toast.success("Handle updated!");
		},
		onError: () => {
			toast.error("Failed to update handle.");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			toast.success("Handle deleted!");
		},
		onError: () => {
			toast.error("Failed to delete handle.");
		},
	});

	const handleEditClick = (handle: UserHandle) => {
		setEditingId(handle.id!);
		setEditedHandle(handle);
	};

	const handleSaveClick = () => {
		if (editedHandle) {
			updateMutation.mutate(editedHandle);
		}
	};

	const handleCancelClick = () => {
		setEditingId(null);
		setEditedHandle(null);
	};

	if (isLoading) return <div>Loading...</div>;

	return (
		<div className="p-4">
			<Card>
				<CardHeader>
					<CardTitle>Manage Twitter Handles</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{handles?.map((handle) => (
							<div key={handle.id} className="flex items-center gap-2">
								{editingId === handle.id ? (
									<>
										<Input
											value={editedHandle?.username || ""}
											onChange={(e) =>
												setEditedHandle((h) =>
													h ? { ...h, username: e.target.value } : null,
												)
											}
											placeholder="Username"
										/>
										<Input
											value={editedHandle?.handle || ""}
											onChange={(e) =>
												setEditedHandle((h) =>
													h ? { ...h, handle: e.target.value } : null,
												)
											}
											placeholder="@handle"
										/>
										<Button onClick={handleSaveClick}>Save</Button>
										<Button onClick={handleCancelClick} variant="outline">
											Cancel
										</Button>
									</>
								) : (
									<>
										<div className="grow">
											{handle.username} ({handle.handle})
										</div>
										<Button
											onClick={() => handleEditClick(handle)}
											variant="outline"
										>
											Edit
										</Button>
										<Button
											onClick={() => deleteMutation.mutate(handle.id!)}
											variant="destructive"
										>
											Delete
										</Button>
									</>
								)}
							</div>
						))}
					</div>
					<div className="mt-4 pt-4 border-t">
						<h3 className="font-bold">Add New Handle</h3>
						<div className="flex items-center gap-2 mt-2">
							<Input
								value={newHandle.username}
								onChange={(e) =>
									setNewHandle({ ...newHandle, username: e.target.value })
								}
								placeholder="Username"
							/>
							<Input
								value={newHandle.handle}
								onChange={(e) =>
									setNewHandle({ ...newHandle, handle: e.target.value })
								}
								placeholder="@handle"
							/>
							<Button onClick={() => createMutation.mutate(newHandle)}>
								Add
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
